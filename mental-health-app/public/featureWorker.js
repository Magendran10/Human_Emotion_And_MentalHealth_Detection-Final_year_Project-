// public/featureWorker.js
// Unified feature extraction worker — handles visual, acoustic, and textual
// modalities in a single worker file.
//
// Message protocol:
//   IN:  { type: 'extract', modality: 'visual'|'acoustic'|'textual', ...payload }
//   OUT: { type: 'log',      message: string }
//         { type: 'progress', modality, pct, message }
//         { type: 'complete', modality, embedding: number[] }
//         { type: 'error',    modality, message: string }
//
// Payload per modality:
//   visual:   { frames: Array<{width, height, data}> }
//   acoustic: { audio: number[], sampleRate: number }
//   textual:  { text: string }

import {
  pipeline,
  AutoProcessor,
  AutoModel,
  AutoTokenizer,
  RawImage,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (msg)              => self.postMessage({ type: 'log', message: msg });
const prog = (modality, pct, msg) => self.postMessage({ type: 'progress', modality, pct, message: msg });
const done = (modality, embedding) => self.postMessage({ type: 'complete', modality, embedding });
const fail = (modality, message)   => self.postMessage({ type: 'error',    modality, message });

// ── Model cache — loaded once, reused for subsequent calls ───────────────────
const cache = {
  visualPipeline:    null,
  audioProcessor:    null,
  audioModel:        null,
  textTokenizer:     null,
  textModel:         null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL — MobileViT-small → mean+max pool across frames → [1280]
// ═══════════════════════════════════════════════════════════════════════════════
const initVisual = async () => {
  if (cache.visualPipeline) return;
  log('📦 [Visual] Loading MobileViT-small...');
  cache.visualPipeline = await pipeline(
    'image-feature-extraction',
    'Xenova/mobilevit-small',
    {
      dtype: 'fp32',
      progress_callback: (p) => {
        if (p.status === 'progress')
          prog('visual', Math.round(p.progress ?? 0), p.file ?? '');
      }
    }
  );
  log('✅ [Visual] MobileViT ready.');
};

/**
 * Reduce [1000] logits → [640] by mean-pool grouping (1000 → 640).
 */
const reduceTo640 = (array) => {
  const out = new Float32Array(640);
  const cnt = new Float32Array(640);
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(i * 640 / array.length);
    out[j] += array[i];
    cnt[j]++;
  }
  for (let j = 0; j < 640; j++) out[j] /= cnt[j];
  return out;
};

const extractVisual = async (frames) => {
  await initVisual();
  const startTime = performance.now();
  log(`[Visual] Processing ${frames.length} frames...`);

  const embeddings = [];
  for (let i = 0; i < frames.length; i++) {
    prog('visual', Math.round((i / frames.length) * 100), `Frame ${i + 1}/${frames.length}`);
    const { width, height, data } = frames[i];
    const image  = new RawImage(new Uint8ClampedArray(data), width, height, 4);
    const output = await cache.visualPipeline(image); // [1, 1000]
    embeddings.push(reduceTo640(output.data));         // [640]
  }

  const dim = 640;

  // Mean pool across frames → [640]
  const meanEmb = new Float32Array(dim);
  for (const e of embeddings) for (let i = 0; i < dim; i++) meanEmb[i] += e[i];
  for (let i = 0; i < dim; i++) meanEmb[i] /= embeddings.length;

  // Max pool across frames → [640]
  const maxEmb = new Float32Array(dim).fill(-Infinity);
  for (const e of embeddings) for (let i = 0; i < dim; i++) {
    if (e[i] > maxEmb[i]) maxEmb[i] = e[i];
  }

  // Concat → [1280]
  const embedding = new Float32Array(1280);
  embedding.set(meanEmb, 0);
  embedding.set(maxEmb, 640);

  log(`✅ [Visual] Embedding: [${embedding.length}] (mean[640]+max[640])`);
  const duration = (performance.now() - startTime).toFixed(2);
  log(`⏱️ [Visual] Inference time: ${duration}ms`);
  return Array.from(embedding);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACOUSTIC — HuBERT-base-ls960 → mean+max pool across time → [1536]
// ═══════════════════════════════════════════════════════════════════════════════
const initAcoustic = async () => {
  if (cache.audioModel) return;
  const ok = await fetch('/models/Xenova/hubert-base-ls960/config.json', { method: 'HEAD' })
    .then(r => r.ok).catch(() => false);
  if (!ok) throw new Error('hubert-base-ls960 not found. Run: node download_hubert.mjs');
  log('📦 [Acoustic] Loading HuBERT-base-ls960...');
  cache.audioProcessor = await AutoProcessor.from_pretrained('Xenova/hubert-base-ls960');
  cache.audioModel     = await AutoModel.from_pretrained('Xenova/hubert-base-ls960');
  log('✅ [Acoustic] HuBERT ready — last_hidden_state [1, T, 768]');
};

const extractAcoustic = async (audio, sampleRate) => {
  await initAcoustic();
  const audioArray = new Float32Array(audio);
  const duration   = (audioArray.length / sampleRate).toFixed(1);
  log(`[Acoustic] Processing ${duration}s of audio...`);
  prog('acoustic', 20, 'Preprocessing audio...');

  const inputs = await cache.audioProcessor(audioArray, { sampling_rate: sampleRate });
  prog('acoustic', 40, 'Running HuBERT inference...');

  const output = await cache.audioModel(inputs);
  const tensor = output.last_hidden_state;
  if (!tensor) throw new Error(`No last_hidden_state. Keys: [${Object.keys(output).join(', ')}]`);

  log(`[Acoustic] Hidden state: [${tensor.dims}]`);
  prog('acoustic', 85, 'Mean+Max pooling...');

  const [, T, H] = tensor.dims;
  const data     = tensor.data;

  // Mean pool across T → [768]
  const meanEmb = new Float32Array(H);
  for (let h = 0; h < H; h++) {
    let sum = 0;
    for (let t = 0; t < T; t++) sum += data[t * H + h];
    meanEmb[h] = sum / T;
  }

  // Max pool across T → [768]
  const maxEmb = new Float32Array(H).fill(-Infinity);
  for (let h = 0; h < H; h++) {
    for (let t = 0; t < T; t++) {
      const v = data[t * H + h];
      if (v > maxEmb[h]) maxEmb[h] = v;
    }
  }

  // Concat → [1536]
  const embedding = new Float32Array(1536);
  embedding.set(meanEmb, 0);
  embedding.set(maxEmb, 768);

  log(`✅ [Acoustic] Embedding: [${embedding.length}] (mean[768]+max[768])`);
  return Array.from(embedding);
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEXTUAL — DistilBERT → CLS token → [768]
// ═══════════════════════════════════════════════════════════════════════════════
const initTextual = async () => {
  if (cache.textModel) return;
  const ok = await fetch('/models/Xenova/distilbert-base-uncased/onnx/model.onnx', { method: 'HEAD' })
    .then(r => r.ok).catch(() => false);
  if (!ok) throw new Error(
    'DistilBERT feature-extraction ONNX not found.\n' +
    'Run: python convert_distilbert.py'
  );
  log('📦 [Textual] Loading DistilBERT tokenizer...');
  cache.textTokenizer = await AutoTokenizer.from_pretrained('Xenova/distilbert-base-uncased');
  log('📦 [Textual] Loading DistilBERT base encoder...');
  cache.textModel = await AutoModel.from_pretrained('Xenova/distilbert-base-uncased', {
    dtype: 'fp32', // loads model.onnx (feature extractor, not MLM)
  });
  log('✅ [Textual] DistilBERT ready.');
};

const extractTextual = async (text) => {
  await initTextual();
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  log(`[Textual] Tokenizing: "${preview}"`);
  prog('textual', 30, 'Tokenizing...');

  const inputs = await cache.textTokenizer(text, {
    truncation:     true,
    max_length:     128,
    padding:        'max_length',
    return_tensors: 'pt',
  });

  const tokenCount = Array.from(inputs.attention_mask.data)
    .filter(v => v === 1n || v === 1).length;
  log(`[Textual] Token count: ${tokenCount}/128`);
  prog('textual', 55, 'Running DistilBERT inference...');

  const output = await cache.textModel(inputs);
  const tensor = output.last_hidden_state;
  if (!tensor) throw new Error(`No last_hidden_state. Keys: [${Object.keys(output).join(', ')}]`);

  log(`[Textual] Hidden state: [${tensor.dims}]`); // [1, 128, 768]
  prog('textual', 90, 'Extracting CLS token...');

  // CLS token = position 0, all 768 dims
  const H   = tensor.dims[2];
  const cls = Array.from(tensor.data.slice(0, H));

  log(`✅ [Textual] Embedding: [${cls.length}] (CLS token)`);
  return cls;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('message', async (event) => {
  const { type, modality, frames, audio, sampleRate, text } = event.data;
  if (type !== 'extract') return;

  try {
    let embedding;

    switch (modality) {
      case 'visual':
        embedding = await extractVisual(frames);
        break;

      case 'acoustic':
        embedding = await extractAcoustic(audio, sampleRate);
        break;

      case 'textual':
        embedding = await extractTextual(text);
        break;

      default:
        throw new Error(`Unknown modality: "${modality}"`);
    }

    prog(modality, 100, 'Done');
    done(modality, embedding);

  } catch (err) {
    log(`❌ [${modality}] ${err.message}`);
    console.error(`[featureWorker:${modality}]`, err);
    fail(modality, err.message);
  }
});

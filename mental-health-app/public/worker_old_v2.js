// public/worker.js
import {
  AutoProcessor,
  AutoModel,
  AutoTokenizer,
  RawImage,
  env
} from '@huggingface/transformers';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

const log = (msg) => self.postMessage({ status: 'log', message: msg });

let visualProcessor = null,   visualModel = null;
let acousticProcessor = null, acousticModel = null;
let textTokenizer = null,     textModel = null;

const checkFileExists = async (url) => {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; }
  catch { return false; }
};

// ── Mean pool: [1, seq, hidden] → [hidden] ────────────────────────────────────
const meanPool = (tensor) => {
  const { dims, data } = tensor;
  if (dims.length === 2) return Array.from(data);
  const [, seqLen, hiddenSize] = dims;
  const out = new Float32Array(hiddenSize);
  for (let h = 0; h < hiddenSize; h++) {
    let sum = 0;
    for (let s = 0; s < seqLen; s++) sum += data[s * hiddenSize + h];
    out[h] = sum / seqLen;
  }
  return Array.from(out);
};

// ── Safe tensor extractor — logs all output keys so we can debug ──────────────
const extractTensorFromOutput = (output, label) => {
  const keys = Object.keys(output);
  log(`🔍 ${label} output keys: [${keys.join(', ')}]`);

  // Try known keys in priority order
  const preferredKeys = ['last_hidden_state', 'pooler_output', 'hidden_states', 'logits'];
  for (const key of preferredKeys) {
    if (output[key] && output[key].dims) {
      log(`✅ ${label} using key: "${key}", dims: [${output[key].dims}]`);
      return output[key];
    }
  }

  // Fallback: use first tensor-like value found
  for (const key of keys) {
    if (output[key] && output[key].dims) {
      log(`⚠️ ${label} falling back to key: "${key}", dims: [${output[key].dims}]`);
      return output[key];
    }
  }

  throw new Error(`${label}: No valid tensor found in output. Keys were: [${keys.join(', ')}]`);
};

// ── Model loaders ─────────────────────────────────────────────────────────────
const initVisual = async () => {
  if (visualModel) return;
  const ok = await checkFileExists('/models/Xenova/mobilevit-small/config.json');
  if (!ok) throw new Error('MobileViT not found at /models/Xenova/mobilevit-small/');
  log('📦 Loading MobileViT...');
  visualProcessor = await AutoProcessor.from_pretrained('Xenova/mobilevit-small');
  visualModel     = await AutoModel.from_pretrained('Xenova/mobilevit-small');
  log('✅ MobileViT ready.');
};

const initAcoustic = async () => {
  if (acousticModel) return;
  const ok = await checkFileExists('/models/Xenova/wav2vec2-base/config.json');
  if (!ok) throw new Error('Wav2Vec2 not found at /models/Xenova/wav2vec2-base/');
  log('📦 Loading Wav2Vec2...');
  acousticProcessor = await AutoProcessor.from_pretrained('Xenova/wav2vec2-base');
  acousticModel     = await AutoModel.from_pretrained('Xenova/wav2vec2-base');
  log('✅ Wav2Vec2 ready.');
};

const initTextual = async () => {
  if (textModel) return;
  const ok = await checkFileExists('/models/Xenova/distilbert-base-uncased/config.json');
  if (!ok) throw new Error('DistilBERT not found at /models/Xenova/distilbert-base-uncased/');
  log('📦 Loading DistilBERT...');
  textTokenizer = await AutoTokenizer.from_pretrained('Xenova/distilbert-base-uncased');
  textModel     = await AutoModel.from_pretrained('Xenova/distilbert-base-uncased');
  log('✅ DistilBERT ready.');
};

// ── Visual extraction ─────────────────────────────────────────────────────────
const extractVisualFeatures = async (frames) => {
  await initVisual();
  log(`🎬 Extracting visual features from ${frames.length} frames...`);

  const embeddings = [];
  for (const frame of frames) {
    const image   = new RawImage(frame.data, frame.width, frame.height, 4);
    const inputs  = await visualProcessor(image);
    const output  = await visualModel(inputs);
    const tensor  = extractTensorFromOutput(output, 'MobileViT');
    embeddings.push(meanPool(tensor));
  }

  const size = embeddings[0].length;
  const avg  = new Float32Array(size);
  for (const e of embeddings) for (let i = 0; i < size; i++) avg[i] += e[i];
  for (let i = 0; i < size; i++) avg[i] /= embeddings.length;

  log(`✅ Visual embedding: [${avg.length}]`);
  return Array.from(avg);
};

// ── Acoustic extraction ───────────────────────────────────────────────────────
const extractAcousticFeatures = async (audio) => {
  await initAcoustic();

  const MAX = 16000 * 30;
  const clipped = audio.length > MAX ? audio.slice(0, MAX) : audio;
  log(`🎵 Extracting acoustic features (${(clipped.length / 16000).toFixed(1)}s)...`);

  // AutoProcessor for wav2vec2 expects a plain Float32Array + sampling_rate
  const inputs = await acousticProcessor(clipped, { sampling_rate: 16000 });

  // Log what inputs look like for debugging
  log(`🔍 Acoustic inputs keys: [${Object.keys(inputs).join(', ')}]`);

  const output  = await acousticModel(inputs);
  const tensor  = extractTensorFromOutput(output, 'Wav2Vec2');
  const embedding = meanPool(tensor);

  log(`✅ Acoustic embedding: [${embedding.length}]`);
  return embedding;
};

// ── Textual extraction ────────────────────────────────────────────────────────
const extractTextualFeatures = async (text) => {
  await initTextual();
  log(`📝 Extracting textual features...`);

  const inputs = await textTokenizer(text, {
    truncation: true, max_length: 128,
    padding: 'max_length', return_tensors: 'pt'
  });

  const output    = await textModel(inputs);
  const tensor    = extractTensorFromOutput(output, 'DistilBERT');
  const hiddenSize = tensor.dims[tensor.dims.length - 1];

  // Use CLS token (index 0) as sentence embedding
  const cls = Array.from(tensor.data.slice(0, hiddenSize));
  log(`✅ Textual embedding: [${cls.length}]`);
  return cls;
};

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  if (type !== 'inference') return;

  try {
    log('⚙️ Starting on-device feature extraction...');
    const features = { visual: null, acoustic: null, textual: null };

    if (payload.visual?.length > 0) {
      try { features.visual = await extractVisualFeatures(payload.visual); }
      catch (err) { log(`⚠️ Visual failed: ${err.message}`); console.error(err); }
    } else { log('ℹ️ No visual data — skipping MobileViT.'); }

    if (payload.acoustic?.length > 0) {
      try {
        const audio = payload.acoustic instanceof Float32Array
          ? payload.acoustic : new Float32Array(payload.acoustic);
        features.acoustic = await extractAcousticFeatures(audio);
      }
      catch (err) { log(`⚠️ Acoustic failed: ${err.message}`); console.error(err); }
    } else { log('ℹ️ No acoustic data — skipping Wav2Vec2.'); }

    if (payload.transcript?.trim().length > 0) {
      try { features.textual = await extractTextualFeatures(payload.transcript); }
      catch (err) { log(`⚠️ Textual failed: ${err.message}`); console.error(err); }
    } else { log('ℹ️ No transcript — skipping DistilBERT.'); }

    log('🏁 Feature extraction complete.');
    log(`📊 visual:[${features.visual?.length ?? 'null'}] acoustic:[${features.acoustic?.length ?? 'null'}] textual:[${features.textual?.length ?? 'null'}]`);

    self.postMessage({ status: 'complete', features });

  } catch (err) {
    log(`❌ Fatal: ${err.message}`);
    self.postMessage({ status: 'error', error: err.message });
  }
});
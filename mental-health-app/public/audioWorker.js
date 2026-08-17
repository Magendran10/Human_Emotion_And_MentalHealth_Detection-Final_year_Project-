// public/audioWorker.js
// HuBERT acoustic feature extraction.
// Output: mean_pool(time) + max_pool(time) concatenated → [1536] = 768+768
//
// HuBERT last_hidden_state: [1, T, 768]
// mean across T → [768], max across T → [768], concat → [1536]

import {
  AutoProcessor,
  AutoModel,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

const log  = (msg)      => self.postMessage({ type: 'log',      message: msg });
const prog = (pct, msg) => self.postMessage({ type: 'progress', pct,     message: msg });

let processor = null;
let model     = null;

const init = async () => {
  if (model) return;
  const ok = await fetch('/models/Xenova/hubert-base-ls960/config.json', { method: 'HEAD' })
    .then(r => r.ok).catch(() => false);
  if (!ok) throw new Error('hubert-base-ls960 not found. Run: node download_hubert.mjs');
  log('📦 Loading HuBERT-base-ls960...');
  processor = await AutoProcessor.from_pretrained('Xenova/hubert-base-ls960');
  model     = await AutoModel.from_pretrained('Xenova/hubert-base-ls960');
  log('✅ HuBERT ready — last_hidden_state [1, T, 768]');
};

self.addEventListener('message', async (event) => {
  const { type, audio, sampleRate } = event.data;
  if (type !== 'extract') return;

  try {
    await init();

    const audioArray = new Float32Array(audio);
    const duration   = (audioArray.length / sampleRate).toFixed(1);
    log(`🎵 Processing ${duration}s of audio...`);
    prog(10, 'Preprocessing...');

    const inputs = await processor(audioArray, { sampling_rate: sampleRate });
    prog(30, 'Running HuBERT inference...');

    const output = await model(inputs);
    const tensor = output.last_hidden_state;
    if (!tensor) throw new Error(`No last_hidden_state. Keys: [${Object.keys(output).join(', ')}]`);

    log(`🔍 Hidden state dims: [${tensor.dims}]`); // [1, T, 768]
    prog(80, 'Mean + Max pooling...');

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

    // Concatenate mean + max → [1536]
    const embedding = new Float32Array(1536);
    embedding.set(meanEmb, 0);
    embedding.set(maxEmb, 768);

    log(`✅ Acoustic embedding: [${embedding.length}] dims (mean[768] + max[768])`);
    prog(100, 'Done');

    self.postMessage({
      type:      'complete',
      embedding: Array.from(embedding),
      duration:  parseFloat(duration),
    });

  } catch (err) {
    log(`❌ ${err.message}`);
    console.error('[audioWorker]', err);
    self.postMessage({ type: 'error', message: err.message });
  }
});
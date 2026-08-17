// public/videoWorker.js
// MobileViT visual feature extraction.
// Output: mean_pool(frames) + max_pool(frames) concatenated → [1280] = 640+640
//
// Each frame: logits [1000] → reduce to [640] via mean-pool grouping
// Across all frames: mean([640]) + max([640]) → concat → [1280]

import {
  pipeline,
  RawImage,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

const log  = (msg)      => self.postMessage({ type: 'log',      message: msg });
const prog = (pct, msg) => self.postMessage({ type: 'progress', pct,     message: msg });

let visualPipeline = null;

const init = async () => {
  if (visualPipeline) return;
  log('📦 Loading MobileViT-small...');
  visualPipeline = await pipeline(
    'image-feature-extraction',
    'Xenova/mobilevit-small',
    {
      dtype: 'fp32',
      progress_callback: (p) => {
        if (p.status === 'progress') prog(Math.round(p.progress ?? 0), p.file ?? '');
      }
    }
  );
  log('✅ MobileViT ready.');
};

/**
 * Reduce [1000] logits → [640] by mean-pooling groups.
 * Same as before — deterministic 1000→640 compression.
 */
const reduceTo640 = (array) => {
  const src = array.length; // 1000
  const tgt = 640;
  const out = new Float32Array(tgt);
  const cnt = new Float32Array(tgt);
  for (let i = 0; i < src; i++) {
    const j = Math.floor(i * tgt / src);
    out[j] += array[i];
    cnt[j]++;
  }
  for (let j = 0; j < tgt; j++) out[j] /= cnt[j];
  return out;
};

self.addEventListener('message', async (event) => {
  const { type, frames } = event.data;
  if (type !== 'extract') return;

  try {
    await init();

    log(`🎬 Processing ${frames.length} frames...`);
    const embeddings = []; // each will be Float32Array[640]

    for (let i = 0; i < frames.length; i++) {
      prog(Math.round((i / frames.length) * 100), `Frame ${i + 1}/${frames.length}`);
      const { width, height, data } = frames[i];
      const image  = new RawImage(new Uint8ClampedArray(data), width, height, 4);
      const output = await visualPipeline(image); // [1, 1000]
      embeddings.push(reduceTo640(output.data));
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

    // Concatenate mean + max → [1280]
    const embedding = new Float32Array(1280);
    embedding.set(meanEmb, 0);
    embedding.set(maxEmb, 640);

    log(`✅ Visual embedding: [${embedding.length}] dims (mean[640] + max[640])`);

    self.postMessage({
      type:       'complete',
      embedding:  Array.from(embedding),
      frameCount: frames.length,
    });

  } catch (err) {
    log(`❌ ${err.message}`);
    console.error('[videoWorker]', err);
    self.postMessage({ type: 'error', message: err.message });
  }
});
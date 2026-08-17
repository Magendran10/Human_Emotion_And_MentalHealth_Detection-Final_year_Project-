// public/textWorker.js
// DistilBERT text feature extraction.
// Output: CLS token from last_hidden_state → [768]
// DistilBERT is already 768 as per architecture — no mean+max needed.
//
// Uses AutoTokenizer + AutoModel with revision:'default'
// to load the base encoder without MLM/classification head.

import {
  AutoTokenizer,
  AutoModel,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

const log  = (msg)      => self.postMessage({ type: 'log',      message: msg });
const prog = (pct, msg) => self.postMessage({ type: 'progress', pct,     message: msg });

let tokenizer = null;
let model     = null;

const init = async () => {
  if (model) return;
  const ok = await fetch('/models/Xenova/distilbert-base-uncased/config.json', { method: 'HEAD' })
    .then(r => r.ok).catch(() => false);
  if (!ok) throw new Error('distilbert-base-uncased not found at /public/models/Xenova/distilbert-base-uncased/');

  log('📦 Loading DistilBERT tokenizer...');
  tokenizer = await AutoTokenizer.from_pretrained('Xenova/distilbert-base-uncased');

  log('📦 Loading DistilBERT base encoder (revision:default, no head)...');
  model = await AutoModel.from_pretrained('Xenova/distilbert-base-uncased', {
    revision: 'default',
  });
  log('✅ DistilBERT ready.');
};

self.addEventListener('message', async (event) => {
  const { type, text } = event.data;
  if (type !== 'extract') return;

  try {
    await init();

    const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;
    log(`📝 Tokenizing: "${preview}"`);
    prog(30, 'Tokenizing...');

    const inputs = await tokenizer(text, {
      truncation:     true,
      max_length:     128,
      padding:        'max_length',
      return_tensors: 'pt',
    });

    const tokenCount = Array.from(inputs.attention_mask.data)
      .filter(v => v === 1n || v === 1).length;
    log(`🔢 Token count: ${tokenCount} (padded to 128)`);
    prog(50, 'Running DistilBERT inference...');

    const output = await model(inputs);
    const keys   = Object.keys(output);
    log(`🔍 Output keys: [${keys.join(', ')}]`);

    const tensor = output.last_hidden_state;
    if (!tensor) throw new Error(`No last_hidden_state. Keys: [${keys.join(', ')}]`);

    log(`🔍 Hidden state dims: [${tensor.dims}]`); // [1, 128, 768]
    prog(85, 'Extracting CLS token...');

    // CLS token at position 0 — [768] sentence embedding
    const H   = tensor.dims[2]; // 768
    const cls = Array.from(tensor.data.slice(0, H));

    log(`✅ Text embedding: [${cls.length}] dims (CLS token)`);
    prog(100, 'Done');

    self.postMessage({
      type:       'complete',
      embedding:  cls,
      tokenCount,
      textLength: text.length,
    });

  } catch (err) {
    log(`❌ ${err.message}`);
    console.error('[textWorker]', err);
    self.postMessage({ type: 'error', message: err.message });
  }
});
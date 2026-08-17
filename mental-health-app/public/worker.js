// public/worker.js
import {
  AutoProcessor,
  AutoModel,
  AutoTokenizer,
  RawImage,
  pipeline,
  env
} from '@huggingface/transformers';

env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

const log = (msg) => self.postMessage({ status: 'log', message: msg });
// NEW: Progress reporter function
const prog = (modality, pct, msg) => self.postMessage({ status: 'progress', modality, pct, message: msg });

let visualPipeline = null;
let acousticProcessor = null, acousticModel = null;
let textTokenizer = null, textModel = null;

// ── VISUAL EXTRACTION (1280 Dims) ──────────────────────────────────────────
const reduceTo640 = (array) => {
  const src = array.length, tgt = 640;
  const out = new Float32Array(tgt), cnt = new Float32Array(tgt);
  for (let i = 0; i < src; i++) {
    const j = Math.floor(i * tgt / src);
    out[j] += array[i];
    cnt[j]++;
  }
  for (let j = 0; j < tgt; j++) out[j] /= cnt[j];
  return out;
};

const extractVisualFeatures = async (frames) => {
  if (!visualPipeline) {
    prog('visual', 5, 'Loading MobileViT...');
    visualPipeline = await pipeline('image-feature-extraction', 'Xenova/mobilevit-small');
  }

  const embeddings = [];
  for (let i = 0; i < frames.length; i++) {
    // Report exact loop progress!
    prog('visual', Math.round((i / frames.length) * 90) + 5, `Processing frame ${i + 1}/${frames.length}`);
    
    const frame = frames[i];
    const image = new RawImage(new Uint8ClampedArray(frame.data), frame.width, frame.height, 4);
    const output = await visualPipeline(image); 
    embeddings.push(reduceTo640(output.data)); 
  }

  prog('visual', 95, 'Pooling features...');
  const dim = 640;
  const meanEmb = new Float32Array(dim);
  const maxEmb = new Float32Array(dim).fill(-Infinity);

  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) {
      meanEmb[i] += e[i];
      if (e[i] > maxEmb[i]) maxEmb[i] = e[i];
    }
  }
  for (let i = 0; i < dim; i++) meanEmb[i] /= embeddings.length;

  const combined = new Float32Array(1280);
  combined.set(meanEmb, 0); combined.set(maxEmb, 640);
  
  prog('visual', 100, 'Complete');
  return Array.from(combined);
};

// ── ACOUSTIC EXTRACTION (1536 Dims) ─────────────────────────────────────────
const extractAcousticFeatures = async (audio) => {
  if (!acousticModel) {
    prog('acoustic', 5, 'Loading HuBERT...');
    acousticProcessor = await AutoProcessor.from_pretrained('Xenova/hubert-base-ls960');
    acousticModel = await AutoModel.from_pretrained('Xenova/hubert-base-ls960');
  }

  prog('acoustic', 30, 'Formatting waveform...');
  const inputs = await acousticProcessor(audio, { sampling_rate: 16000 });
  
  prog('acoustic', 60, 'Running inference...');
  const output = await acousticModel(inputs);
  const tensor = output.last_hidden_state;
  
  prog('acoustic', 85, 'Pooling features...');
  const [, T, H] = tensor.dims; 
  const data = tensor.data;

  const meanEmb = new Float32Array(H);
  const maxEmb = new Float32Array(H).fill(-Infinity);

  for (let h = 0; h < H; h++) {
    for (let t = 0; t < T; t++) {
      const val = data[t * H + h];
      meanEmb[h] += val;
      if (val > maxEmb[h]) maxEmb[h] = val;
    }
    meanEmb[h] /= T;
  }

  const combined = new Float32Array(1536);
  combined.set(meanEmb, 0); combined.set(maxEmb, 768);
  
  prog('acoustic', 100, 'Complete');
  return Array.from(combined);
};

// ── LINGUISTIC EXTRACTION (768 Dims) ────────────────────────────────────────
const extractTextualFeatures = async (text) => {
  if (!textModel) {
    prog('textual', 5, 'Loading DistilBERT...');
    textTokenizer = await AutoTokenizer.from_pretrained('Xenova/distilbert-base-uncased');
    textModel = await AutoModel.from_pretrained('Xenova/distilbert-base-uncased', { revision: 'default' });
  }

  prog('textual', 30, 'Tokenizing text...');
  const inputs = await textTokenizer(text, {
    truncation: true, max_length: 128,
    padding: 'max_length', return_tensors: 'pt'
  });

  prog('textual', 70, 'Running inference...');
  const output = await textModel(inputs);
  const tensor = output.last_hidden_state;
  
  prog('textual', 90, 'Extracting CLS...');
  const H = tensor.dims[2]; 
  const cls = Array.from(tensor.data.slice(0, H)); 
  
  prog('textual', 100, 'Complete');
  return cls;
};

// ── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  if (type !== 'inference') return;

  try {
    const features = { visual: null, acoustic: null, textual: null };

    // Initialize all active trackers to 0%
    if (payload.visual?.length > 0) prog('visual', 0, 'Waiting in queue...');
    if (payload.acoustic?.length > 0) prog('acoustic', 0, 'Waiting in queue...');
    if (payload.transcript?.trim().length > 0) prog('textual', 0, 'Waiting in queue...');

    if (payload.visual?.length > 0) {
      features.visual = await extractVisualFeatures(payload.visual);
    }
    if (payload.acoustic?.length > 0) {
      const audio = payload.acoustic instanceof Float32Array ? payload.acoustic : new Float32Array(payload.acoustic);
      features.acoustic = await extractAcousticFeatures(audio);
    } 
    if (payload.transcript?.trim().length > 0) {
      features.textual = await extractTextualFeatures(payload.transcript);
    }

    self.postMessage({ status: 'complete', features });

  } catch (err) {
    log(`❌ Fatal: ${err.message}`);
    self.postMessage({ status: 'error', error: err.message });
  }
});
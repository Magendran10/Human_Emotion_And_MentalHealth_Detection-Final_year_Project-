import { pipeline, env, Tensor } from '@xenova/transformers';

// 1. Configure for local models
env.allowLocalModels = true;
env.localModelPath = '/models/'; 

// Models and Transcriber stored globally to avoid re-loading
let videoExtractor, audioExtractor, textExtractor;

/**
 * Initializes all required models specifically for Moonshine and Trimodal Inference
 */
const initModels = async () => {
    if (!videoExtractor) videoExtractor = await pipeline('image-feature-extraction', 'mobilevit_video');
    if (!audioExtractor) audioExtractor = await pipeline('feature-extraction', 'wav2vec_audio');
    if (!textExtractor) textExtractor = await pipeline('feature-extraction', 'distilbert_text');
    
};

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    try {
        if (type === 'inference') {
            await initModels(); // Ensure all engines are running
            const results = { visualEmb: null, acousticEmb: null, textualEmb: null, transcript: payload.transcript || "" };

            // A. Video Inference
            if (payload.visual) {
                const videoTensor = new Tensor('float32', payload.visual, [5, 3, 256, 256]);
                results.visualEmb = await videoExtractor(videoTensor);
            }

            // B. Audio Inference
            if (payload.acoustic) {
                // Feature Extraction
                const audioTensor = new Tensor('float32', payload.acoustic, [1, payload.acoustic.length]);
                results.acousticEmb = await audioExtractor(audioTensor);
            }

            if (results.transcript) {
                results.textualEmb = await textExtractor(results.transcript);
            }
            // C. Text Inference
            if (payload.textual && !results.textualEmb) {
                const textTensor = new Tensor('int64', payload.textual.inputIds, [1, 128]);
                results.textualEmb = await textExtractor(textTensor);
            }

            // D. Result Return
            self.postMessage({ 
                status: 'complete', 
                results: {
                    visual: results.visualEmb.data ?? null,
                    acoustic: results.acousticEmb.data ?? null,
                    textual: results.textualEmb.data ?? null,
                    transcript: results.transcript 
                } 
            });
        }
    } catch (err) {
        self.postMessage({ status: 'error', error: err.message });
    }
});
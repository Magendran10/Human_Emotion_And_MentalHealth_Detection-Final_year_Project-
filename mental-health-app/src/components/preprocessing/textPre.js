// src/components/preprocessing/textPre.js
// Tokenizes text using local DistilBERT model files.
// Model must exist at: /public/models/Xenova/distilbert-base-uncased/

import { AutoTokenizer, env } from '@huggingface/transformers';

// Use local models only — no HuggingFace network calls
env.allowLocalModels  = true;
env.allowRemoteModels = false;
env.useBrowserCache   = false;
env.localModelPath    = '/models/';

let tokenizerInstance = null;

/**
 * Tokenizes input text using DistilBERT tokenizer (local, on-device).
 * Returns token ids, attention mask, and token type ids padded to max 128.
 *
 * @param {string} text - Raw input text
 * @param {Function} onLog - Callback for system logs
 * @returns {{ inputIds: number[], attentionMask: number[], tokenTypeIds: number[] }}
 */
export const processTextTokens = async (text, onLog) => {
  try {
    onLog("🔡 Initializing DistilBERT Tokenizer from local assets...");

    // Reuse tokenizer instance across calls
    if (!tokenizerInstance) {
      tokenizerInstance = await AutoTokenizer.from_pretrained(
        'Xenova/distilbert-base-uncased'
        // resolves to /models/Xenova/distilbert-base-uncased/ via localModelPath
      );
    }

    onLog("✂️ Tokenizing and applying padding/truncation (Max: 128)...");

    const encoded = await tokenizerInstance(text, {
      truncation:      true,
      max_length:      128,
      padding:         'max_length',
      return_tensors:  'pt',
    });

    const inputIds      = Array.from(encoded.input_ids.data);
    const attentionMask = Array.from(encoded.attention_mask.data);
    const tokenTypeIds  = encoded.token_type_ids
      ? Array.from(encoded.token_type_ids.data)
      : new Array(128).fill(0);

    onLog(`✅ Text Preprocessing Complete: ${inputIds.length} tokens generated.`);

    return { inputIds, attentionMask, tokenTypeIds };

  } catch (error) {
    onLog(`❌ Text Preprocessing Error: ${error.message}`);
    onLog(`   → Ensure model exists at: /public/models/Xenova/distilbert-base-uncased/`);
    onLog(`   → Required files: config.json, tokenizer.json, tokenizer_config.json`);
    console.error('[textPre]', error);
    throw error;
  }
};
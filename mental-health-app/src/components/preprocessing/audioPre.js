// // src/preprocessing/audioPre.js
// // src/components/preprocessing/audioPre.js
// // src/components/preprocessing/audioPre.js
// import * as Vosk from 'vosk-browser';
// /**
//  * Transcribes a Float32Array using Vosk-browser.
//  * Uses the correct event-driven API with AudioBuffer chunks via ScriptProcessorNode.
//  * @param {Float32Array} audioData - 16kHz mono audio
//  * @param {Function} onLog
//  * @returns {Promise<string>} - Final transcript text
//  */

// export const transcribeSpeech = (audioData, onLog) => {
//   return new Promise(async (resolve, reject) => {
//     onLog("🎙️ Vosk: Loading model...");
//     let model = null;
//     let recognizer = null;

//     try {
//       model = await Vosk.createModel('/models/vosk-model-small-en-us-0.15.zip');
//       onLog("✅ Vosk: Model loaded. Initializing recognizer...");

//       recognizer = new model.KaldiRecognizer(16000);
//       const transcriptParts = [];

//       // Results come through events asynchronously
//       recognizer.on("result", (message) => {
//         const text = message.result?.text;
//         if (text && text.trim()) {
//           onLog(`📝 Vosk: "${text}"`);
//           transcriptParts.push(text.trim());
//         }
//       });

//       const durationSeconds = audioData.length / 16000;
//       onLog(`📊 Vosk: Processing ${durationSeconds.toFixed(1)}s of audio...`);

//       // Feed in chunks as real AudioBuffer objects
//       const tmpCtx = new AudioContext({ sampleRate: 16000 });
//       const chunkSize = 4096;
//       for (let i = 0; i < audioData.length; i += chunkSize) {
//         const chunk = audioData.slice(i, i + chunkSize);
//         const audioBuffer = tmpCtx.createBuffer(1, chunk.length, 16000);
//         audioBuffer.copyToChannel(chunk, 0);
//         recognizer.acceptWaveform(audioBuffer);
//         // recognizer.acceptWaveformFloat(chunk, 16000);
//       }

//       tmpCtx.close();

//       // Wait for Vosk's worker to flush all result events
//       // Scale to duration: longer audio needs more flush time
//       const flushWait = Math.min(Math.max(durationSeconds * 150, 3000), 10000);
//       onLog(`⏳ Vosk: Flushing results (${(flushWait / 1000).toFixed(1)}s)...`);
//       await new Promise(r => setTimeout(r, flushWait));
      
//       const fullTranscript = transcriptParts.join(' ').trim();
//       onLog(`✅ Vosk: Transcript ready: "${fullTranscript || '(empty)'}"`);

//       recognizer.remove();
//       model.terminate();
//       resolve(fullTranscript || "");

//     } catch (error) {
//       onLog(`❌ Vosk Error: ${error.message}`);
//       console.error("Vosk transcription error:", error);
//       if (recognizer) recognizer.remove();
//       if (model) model.terminate();
//       reject(error);
//     }
//   });
// };

// /**
//  * Extracts, preprocesses, and returns clean audio from any media blob.
//  *
//  * Full preprocessing chain:
//  *  1. Decode audio at native rate
//  *  2. Mix stereo to mono by AVERAGING both channels (not just left channel)
//  *  3. Resample to 16kHz via OfflineAudioContext
//  *  4. Apply speech bandpass filter (80Hz-8000Hz) to remove noise/music
//  *  5. Normalize volume to peak ~-1dB (critical for Vosk VAD accuracy)
//  *  6. Trim only true leading/trailing silence
//  *
//  * @param {Blob} mediaBlob
//  * @param {Function} onLog
//  */

// export const extractAndTranscribe = async (mediaBlob, onLog) => {
//   onLog("🎵 Extracting Audio Track from Media...");

//   // Step 1: Decode at native sample rate (do NOT force 16kHz here)
//   const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//   const arrayBuffer = await mediaBlob.arrayBuffer();
//   const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
//   await audioCtx.close();

//   onLog(`📻 Decoded: ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(1)}s`);

//   // Step 2: Mix ALL channels to mono by averaging
//   // Never use only channel 0 — AI/camera audio centers speech across channels
//   const mixed = mixToMono(audioBuffer);
//   onLog("🔀 Mixed to mono (averaged all channels).");

//   // Step 3: Resample to 16kHz
//   onLog("📉 Resampling to 16kHz...");
//   const resampled = await resampleTo16k(mixed, audioBuffer.sampleRate);

//   // Step 4: Bandpass filter for speech (removes music, hum, high-freq noise)
//   onLog("🎚️ Applying speech bandpass filter (80Hz-8000Hz)...");
//   const filtered = await applyBandpassFilter(resampled, 16000);

//   // Step 5: Normalize volume — THE most critical fix
//   // Audio at -28dB mean makes Vosk VAD think everything is silence
//   // Vosk only emits result events at silence boundaries it detects
//   onLog("🔊 Normalizing volume for Vosk VAD...");
//   const normalized = normalizeAudio(filtered, onLog);

//   // Step 6: Trim only true leading/trailing silence
//   const cleanAudio = trimSilence(normalized, 0.005);
//   onLog(`✂️ Edge silence trimmed: ${resampled.length} → ${cleanAudio.length} samples`);

//   const previewUrl = generateAudioPreview(cleanAudio, 16000);
//   onLog("🔊 Audio preview generated.");

//   return {
//     acousticData: cleanAudio,
//     previewUrl
//   };
// };

// src/components/preprocessing/audioPre.js
import * as Vosk from 'vosk-browser';

/**
 * Transcribes preprocessed 16kHz mono Float32Array using Vosk-browser.
 *
 * Handles all failure modes:
 * - Short audio (< 15s): silence padding forces VAD to flush final sentence
 * - Tiny gaps (< 0.5s): padding guarantees at least one result event fires
 * - Long audio: scaled flush wait catches all mid-audio result events
 *
 * @param {Float32Array} audioData - 16kHz mono, normalized audio
 * @param {Function} onLog
 * @returns {Promise<string>}
 */
export const transcribeSpeech = (audioData, onLog) => {
  return new Promise(async (resolve, reject) => {
    onLog("🎙️ Vosk: Loading model...");
    let model = null;
    let recognizer = null;

    try {
      model = await Vosk.createModel('/models/vosk-model-small-en-us-0.15.zip');
      onLog("✅ Vosk: Model loaded.");

      recognizer = new model.KaldiRecognizer(16000);
      const transcriptParts = [];

      recognizer.on("result", (message) => {
        const text = message.result?.text;
        if (text && text.trim()) {
          onLog(`📝 Vosk: "${text}"`);
          transcriptParts.push(text.trim());
        }
      });

      const durationSeconds = audioData.length / 16000;
      onLog(`📊 Vosk: Processing ${durationSeconds.toFixed(1)}s of audio...`);

      // Append 1.5s of silence BEFORE feeding audio to Vosk.
      // WHY: Vosk's VAD needs a silence gap >= ~0.5s to fire result events.
      // Short AI/video audio often has gaps of only 0.2-0.4s — not enough.
      // Appending silence at the end guarantees the final sentence is flushed.
      const SILENCE_PAD_SECONDS = 1.5;
      const silencePad = new Float32Array(Math.ceil(16000 * SILENCE_PAD_SECONDS));
      const paddedAudio = new Float32Array(audioData.length + silencePad.length);
      paddedAudio.set(audioData, 0);
      paddedAudio.set(silencePad, audioData.length);

      onLog(`➕ Added ${SILENCE_PAD_SECONDS}s silence pad to flush final sentence.`);

      // Feed in chunks as real AudioBuffer objects (required by acceptWaveform)
      const tmpCtx = new AudioContext({ sampleRate: 16000 });
      const chunkSize = 4096;

      for (let i = 0; i < paddedAudio.length; i += chunkSize) {
        const chunk = paddedAudio.slice(i, i + chunkSize);
        const audioBuffer = tmpCtx.createBuffer(1, chunk.length, 16000);
        audioBuffer.copyToChannel(chunk, 0);
        recognizer.acceptWaveform(audioBuffer);
      }

      tmpCtx.close();

      // Wait for Vosk worker to flush all result events
      // Minimum 3s, scales up for longer audio
      const flushWait = Math.min(Math.max(durationSeconds * 150, 3000), 10000);
      onLog(`⏳ Vosk: Flushing (${(flushWait / 1000).toFixed(1)}s)...`);
      await new Promise(r => setTimeout(r, flushWait));

      const fullTranscript = transcriptParts.join(' ').trim();

      if (!fullTranscript) {
        onLog("⚠️ Vosk: No result events fired. Audio may be too quiet or non-speech.");
      } else {
        onLog(`✅ Vosk: Transcript complete: "${fullTranscript}"`);
      }

      recognizer.remove();
      model.terminate();
      resolve(fullTranscript);

    } catch (error) {
      onLog(`❌ Vosk Error: ${error.message}`);
      try { recognizer?.remove(); } catch (_) {}
      try { model?.terminate(); } catch (_) {}
      reject(error);
    }
  });
};

/**
 * Extracts and preprocesses audio from any media Blob for Vosk.
 *
 * Pipeline:
 *  1. Decode at native sample rate (no forced 16kHz — avoids quality loss)
 *  2. Mix ALL channels to mono by averaging (fixes stereo phase issues)
 *  3. Resample to 16kHz via OfflineAudioContext
 *  4. Bandpass filter 80Hz–8000Hz (removes music, hum, hiss)
 *  5. Normalize to peak -1dB (fixes Vosk VAD on quiet audio)
 *  6. Trim only true edge silence (threshold 0.005, safe for quiet speech)
 *
 * @param {Blob} mediaBlob
 * @param {Function} onLog
 */
export const extractAndTranscribe = async (mediaBlob, onLog) => {
  onLog("🎵 Extracting audio from media...");

  // Step 1: Decode at native sample rate
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await mediaBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  onLog(`📻 Decoded: ${audioBuffer.numberOfChannels}ch @ ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(1)}s`);

  // Step 2: Mix ALL channels to mono (never use only channel 0)
  const mixed = mixToMono(audioBuffer);
  onLog("🔀 Mixed to mono (averaged all channels).");

  // Step 3: Resample to 16kHz
  onLog("📉 Resampling to 16kHz...");
  const resampled = await resampleTo16k(mixed, audioBuffer.sampleRate);

  // Step 4: Bandpass filter — remove non-speech frequencies
  onLog("🎚️ Applying speech bandpass filter (80Hz–8000Hz)...");
  const filtered = await applyBandpassFilter(resampled, 16000);

  // Step 5: Normalize volume (critical — Vosk VAD fails on quiet audio)
  onLog("🔊 Normalizing volume...");
  const normalized = normalizeAudio(filtered, onLog);

  // Step 6: Trim edge silence only
  const cleanAudio = trimSilence(normalized, 0.005);
  onLog(`✂️ Edge trimmed: ${resampled.length} → ${cleanAudio.length} samples`);

  const previewUrl = generateAudioPreview(cleanAudio, 16000);
  onLog("🔊 Preview generated.");

  return { acousticData: cleanAudio, previewUrl };
};

// export const extractAndTranscribe = async (fileBlob, onLog) => {
//   onLog("🎙️ Extracting RAW 16kHz audio (No Filters)...");
  
//   const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//   const arrayBuffer = await fileBlob.arrayBuffer();
//   const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
//   await audioCtx.close();

//   // 1. Mix to Mono
//   const numCh = audioBuffer.numberOfChannels;
//   const length = audioBuffer.length;
//   const mono = new Float32Array(length);
//   for (let ch = 0; ch < numCh; ch++) {
//     const chData = audioBuffer.getChannelData(ch);
//     for (let i = 0; i < length; i++) mono[i] += chData[i] / numCh;
//   }

//   // 2. Resample to 16kHz exactly like librosa
//   const targetRate = 16000;
//   const targetLength = Math.ceil(length * targetRate / audioBuffer.sampleRate);
//   const offCtx = new OfflineAudioContext(1, targetLength, targetRate);
//   const buf = offCtx.createBuffer(1, length, audioBuffer.sampleRate);
//   buf.copyToChannel(mono, 0);
  
//   const src = offCtx.createBufferSource();
//   src.buffer = buf;
//   src.connect(offCtx.destination);
//   src.start();
  
//   const renderedBuffer = await offCtx.startRendering();
//   const raw16kHzAudio = renderedBuffer.getChannelData(0);

//   onLog("✅ Raw 16kHz extraction complete.");
  
//   return { acousticData: raw16kHzAudio };
// };

/**
 * Averages ALL channels into a single mono Float32Array.
 * Never use only channel 0 — speech in AI/camera video is often centered.
 */
const mixToMono = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }
  return mono;
};

const resampleTo16k = async (float32Array, sourceSampleRate) => {
  if (sourceSampleRate === 16000) return float32Array;

  const targetRate = 16000;
  const targetLength = Math.ceil(float32Array.length * targetRate / sourceSampleRate);
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetRate);

  const buffer = offlineCtx.createBuffer(1, float32Array.length, sourceSampleRate);
  buffer.copyToChannel(float32Array, 0);

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
};

/**
 * Speech bandpass filter: 80Hz highpass + 8000Hz lowpass.
 * - Removes: background music bass, low-freq hum, high-freq hiss
 * - Keeps: human speech range (80Hz-8000Hz)
 * Dramatically improves Vosk VAD detection on AI-generated and camera audio.
 */
const applyBandpassFilter = async (float32Array, sampleRate) => {
  const offlineCtx = new OfflineAudioContext(1, float32Array.length, sampleRate);

  const buffer = offlineCtx.createBuffer(1, float32Array.length, sampleRate);
  buffer.copyToChannel(float32Array, 0);

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;
  highpass.Q.value = 0.7;

  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 8000;
  lowpass.Q.value = 0.7;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
};

/**
 * Normalizes audio to peak ~-1dB (amplitude 0.9).
 *
 * WHY THIS IS CRITICAL:
 * Vosk uses a Voice Activity Detector (VAD) to decide when to emit result events.
 * It detects speech/silence boundaries based on signal amplitude.
 * At -28dB mean volume, Vosk's VAD treats ALL audio as near-silence,
 * so it never fires result events between sentences — only at the very end.
 * After normalization, VAD correctly detects pauses between sentences
 * and fires result events throughout the audio.
 */
const normalizeAudio = (float32Array, onLog) => {
  let peak = 0;
  for (let i = 0; i < float32Array.length; i++) {
    const abs = Math.abs(float32Array[i]);
    if (abs > peak) peak = abs;
  }

  if (peak === 0) {
    onLog("⚠️ Audio appears silent — skipping normalization.");
    return float32Array;
  }

  const targetPeak = 0.9;
  const gain = targetPeak / peak;
  const normalized = new Float32Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    normalized[i] = float32Array[i] * gain;
  }

  const dbBefore = (20 * Math.log10(peak)).toFixed(1);
  const dbAfter = (20 * Math.log10(targetPeak)).toFixed(1);
  onLog(`📈 Volume: ${dbBefore}dB → ${dbAfter}dB (${gain.toFixed(2)}x gain applied)`);

  return normalized;
};

/**
 * Trims only true leading/trailing silence.
 * threshold 0.005 is safe — never cuts mid-audio pauses or quiet speech.
 */
const trimSilence = (buffer, threshold = 0.005) => {
  let start = 0;
  while (start < buffer.length && Math.abs(buffer[start]) < threshold) start++;
  let end = buffer.length - 1;
  while (end > start && Math.abs(buffer[end]) < threshold) end--;
  return buffer.slice(start, end + 1);
};

/**
 * Utility: Standardizes clip duration by removing leading/trailing silence
 */
// const removeSilence = (buffer, threshold=0.005) => {
//   let start = 0;
//   while (start < buffer.length && Math.abs(buffer[start]) < threshold) start++;
  
//   let end = buffer.length - 1;
//   while (end > start && Math.abs(buffer[end]) < threshold) end--;
  
//   return buffer.slice(start, end + 1);
// };

/**
 * Utility: Converts Float32Array to a standard playable WAV Blob
 * @param {Float32Array} float32Array - Raw audio samples
 * @param {number} sampleRate - The rate used for extraction (e.g., 16000)
 */
const generateAudioPreview = (float32Array, sampleRate) => {
  const buffer = new ArrayBuffer(44 + float32Array.length * 2);
  const view = new DataView(buffer);

  // Helper to write strings into DataView
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // 1. RIFF Header
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + float32Array.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM Format (1)
  view.setUint16(22, 1, true); // Mono Channel (1)
  
  // --- SAMPLE RATE USED HERE ---
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate * 2, true); // Byte Rate
  view.setUint16(32, 2, true);              // Block Align
  view.setUint16(34, 16, true);             // Bits per sample
  
  // 2. Data Chunk
  writeString(36, 'data');
  view.setUint32(40, float32Array.length * 2, true);

  // 3. Write PCM samples (Float32 to Int16)
  let offset = 44;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
};
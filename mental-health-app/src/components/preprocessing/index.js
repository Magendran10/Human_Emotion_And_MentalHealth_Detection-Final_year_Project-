// // src/components/preprocessing/index.js
// import { processVideoFrames } from './videoPre';
// import { extractAndTranscribe,transcribeSpeech} from './audioPre';
// import { processTextTokens } from './textPre';

// /**
//  * Orchestrates the multimodal preprocessing pipeline based on confirmed input.
//  * @param {Object} data - The raw confirmed data (video, audio, or text).
//  * @param {string} mode - The active input mode ('video', 'audio', or 'text').
//  * @param {Function} onLog - Callback for real-time system logs.
//  * @param {Function} onAudioReady - Callback to provide the extracted audio preview URL.
//  * @param {Function} onTranscriptReady - Callback to display the Vosk transcript.
//  */
// export const runFullPreprocessing = async (data, mode, onLog, onAudioReady, onTranscriptReady) => {
//   const results = { visual: null, acoustic: null, textual: null, transcript: ""};

//   try {
//     // 1. Scenario: Video with (or without) Audio
//     if (mode === 'video' && data.video) {
//       onLog("🚀 Initiating Video-First Pipeline...");
      
//       // Step A: Visual Preprocessing (Haar Cascade, ROI, 256x256, Normalized)
//       results.visual = await processVideoFrames(data.video, onLog);

//       // Step B: Acoustic Extraction & Transcription (16kHz, Silence Removal, Vosk)
//       if (data.hasAudioInVideo) {
//         const audioResults = await extractAndTranscribe(data.video, onLog);
//         results.acoustic = audioResults.acousticData;
        
//         // Handle Previews for UI
//         onAudioReady(audioResults.previewUrl);
//         onLog("🎙️ Starting Vosk transcription...");
//         const transcript = await transcribeSpeech(audioResults.acousticData, onLog);
//         onTranscriptReady(transcript);

//         // Step C: Textual Preprocessing (Tokenization, 128 max length)
//         // Tokenization on Vosk transcript
//         if (transcript) {
//           results.textual = await processTextTokens(transcript, onLog);
//         }
//       }
//     } 

//     // 2. Scenario: Standalone Audio
//     else if (mode === 'audio' && data.audio) {
//       onLog("🚀 Initiating Standalone Audio Pipeline...");
      
//       const audioResults = await extractAndTranscribe(data.audio, onLog);
//       results.acoustic = audioResults.acousticData;
      
//       onAudioReady(audioResults.previewUrl);
//       const transcript = await transcribeSpeech(audioResults.acousticData, onLog);
//       onTranscriptReady(transcript);

//       // Tokenization on Vosk transcript
//       if (transcript) {
//         results.textual = await processTextTokens(transcript, onLog);
//       }
//     } 

//     // 3. Scenario: Standalone Text
//     else if (mode === 'text' && (data.text && data.text.length > 0)) {
//       onLog("🚀 Initiating Text-only Pipeline...");
//       onTranscriptReady(data.text);
//       results.textual = await processTextTokens(data.text, onLog);
//     }else {
//     onLog("ℹ️ Skipping initial tokenization. Waiting for Moonshine ASR...");
//     }

//     onLog("🏁 All Preprocessing Complete. Ready for ONNX Inference.");
//     return results; // Final objects: 256x256 visual, 16kHz acoustic, 128-token textual

//   } catch (error) {
//     onLog(`❌ Error in Preprocessing: ${error.message}`);
//     console.error(error);
//     throw error;
//   }
// };



// src/components/preprocessing/index.js
import { processVideoFrames } from './videoPre';
import { extractAndTranscribe, transcribeSpeech } from './audioPre';
// ❌ REMOVED textPre import! The Web Worker handles tokenization now.

/**
 * Orchestrates the multimodal preprocessing pipeline based on confirmed input.
 */
export const runFullPreprocessing = async (data, mode, onLog, onAudioReady, onTranscriptReady) => {
  // textual is no longer generated here; we just pass the raw transcript
  const results = { visual: null, acoustic: null, transcript: "" };

  try {
    // 1. Scenario: Video with (or without) Audio
    if (mode === 'video' && data.video) {
      onLog("🚀 Initiating Video-First Pipeline...");
      
      // Step A: Visual Preprocessing (Haar Cascade, ROI, 256x256, Normalized)
      results.visual = await processVideoFrames(data.video, onLog);

      // Step B: Acoustic Extraction & Transcription (16kHz, Silence Removal, Vosk)
      try {
        onLog("🎵 Extracting audio track from video...");
        const audioResults = await extractAndTranscribe(data.video, onLog);
        results.acoustic = audioResults.acousticData;
        onAudioReady(audioResults.previewUrl);

        // Vosk transcription — wrapped separately so failure doesn't kill acoustic
        try {
          onLog("🎙️ Starting Vosk transcription...");
          results.transcript = await transcribeSpeech(audioResults.acousticData, onLog);
          onTranscriptReady(results.transcript);
        } catch (voskErr) {
          onLog(`⚠️ Vosk skipped: ${voskErr.message}`);
          results.transcript = "";
        }
      } catch (audioErr) {
        onLog(`⚠️ Audio extraction failed: ${audioErr.message} — visual only.`);
      }
    } 

    // 2. Scenario: Standalone Audio
    else if (mode === 'audio' && data.audio) {
      onLog("🚀 Initiating Standalone Audio Pipeline...");
      
      const audioResults = await extractAndTranscribe(data.audio, onLog);
      results.acoustic = audioResults.acousticData;
      
      onAudioReady(audioResults.previewUrl);
      
      results.transcript = await transcribeSpeech(audioResults.acousticData, onLog);
      onTranscriptReady(results.transcript);
    } 

    // 3. Scenario: Standalone Text
    else if (mode === 'text' && (data.text && data.text.length > 0)) {
      onLog("🚀 Initiating Text-only Pipeline...");
      results.transcript = data.text;
      onTranscriptReady(data.text);
    }

    onLog("🏁 All Preprocessing Complete. Ready for ONNX Inference.");
    return results; 

  } catch (error) {
    onLog(`❌ Error in Preprocessing: ${error.message}`);
    console.error(error);
    throw error;
  }
};
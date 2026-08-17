// src/components/preprocessing/videoPre.js

export const processVideoFrames = async (videoBlob, onLog) => {
  onLog("🎬 Starting Video Preprocessing (5 FPS)...");
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    
    video.onerror = () => reject(new Error('Failed to load video'));

    video.onloadeddata = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = 256; 
      canvas.height = 256;

      const fps = 5;
      const totalFrames = Math.floor(video.duration * fps);
      const frameInterval = 1 / fps;
      
      const frames = []; // Array of objects for the worker
      
      onLog(`📐 Extracting ${totalFrames} frames for MobileViT analysis...`);

      for (let i = 0; i < totalFrames; i++) {
        video.currentTime = i * frameInterval;
        await new Promise((res) => (video.onseeked = res));

        // Draw and extract raw RGBA pixel data
        ctx.drawImage(video, 0, 0, 256, 256);
        const imageData = ctx.getImageData(0, 0, 256, 256);
        
        frames.push({
          width: 256,
          height: 256,
          data: Array.from(imageData.data) // RGBA 0-255 required by HuggingFace RawImage
        });
        
        if (i > 0 && i % 5 === 0) onLog(`Processed ${Math.floor(i/fps)} seconds...`);
      }

      onLog("✅ 5 FPS Preprocessing Complete.");
      URL.revokeObjectURL(video.src);
      resolve(frames); 
    };
  });
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, Play, Square, Loader2, Settings2 } from 'lucide-react';

// Define the GIF.js type since we're using it from a CDN
declare const GIF: any;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState('SPIRAL FUNNEL ');
  const [speed, setSpeed] = useState(1);
  const [bgColor, setBgColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#ffffff');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(Date.now());
  const loopDuration = 4000; // 4 seconds for a full loop

  // Constants for the effect
  const fontSize = 40;
  const lineHeight = 50;
  const spiralFactor = 0.05;
  const depthScale = 0.5;
  const repeatDistance = 300;

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  };

  const renderTextPattern = (ctx: CanvasRenderingContext2D, time: number, width: number, height: number) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(text).width;
    if (textWidth === 0) return;

    // Calculate horizontal offset based on time
    // We want it to loop perfectly over loopDuration
    const scrollOffset = (time % loopDuration) / loopDuration * textWidth;

    const rows = Math.ceil(height / lineHeight) + 1;
    const cols = Math.ceil(width / textWidth) + 2;

    for (let y = 0; y < rows; y++) {
      for (let x = -1; x < cols; x++) {
        ctx.fillText(text, x * textWidth + scrollOffset, y * lineHeight);
      }
    }
  };

  const transformToSpiral = (
    srcCanvas: HTMLCanvasElement,
    dstCtx: CanvasRenderingContext2D,
    time: number,
    width: number,
    height: number
  ) => {
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;

    const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const dstData = dstCtx.createImageData(srcCanvas.width, srcCanvas.height);
    
    const srcPixels = new Uint32Array(srcData.data.buffer);
    const dstPixels = new Uint32Array(dstData.data.buffer);

    const centerX = srcCanvas.width / 2;
    const centerY = srcCanvas.height / 2;
    
    // Rotation of the spiral itself
    const rotation = (time % loopDuration) / loopDuration * Math.PI * 2;

    // Optimization: Process in blocks or just use a fast loop
    // For 2D canvas, per-pixel is slow but manageable for demos if resolution isn't huge.
    // We'll use a step of 1 for quality, but we could use 2 for performance.
    const step = 1;

    for (let y = 0; y < srcCanvas.height; y += step) {
      for (let x = 0; x < srcCanvas.width; x += step) {
        const dx = x - centerX;
        const dy = y - centerY;
        const r = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Spiral transformation
        const angle2 = angle + r * spiralFactor + rotation;
        
        // Depth compression with infinite wrap
        let r2 = (r * depthScale) % repeatDistance;
        
        // Map back to source coordinates
        let sx = Math.floor(centerX + Math.cos(angle2) * r2);
        let sy = Math.floor(centerY + Math.sin(angle2) * r2);

        // Wrap source coordinates
        sx = (sx % srcCanvas.width + srcCanvas.width) % srcCanvas.width;
        sy = (sy % srcCanvas.height + srcCanvas.height) % srcCanvas.height;

        const dstIdx = y * srcCanvas.width + x;
        const srcIdx = sy * srcCanvas.width + sx;
        
        dstPixels[dstIdx] = srcPixels[srcIdx];
        
        // If step > 1, fill the block
        if (step > 1) {
          for (let i = 0; i < step; i++) {
            for (let j = 0; j < step; j++) {
              if (x + i < srcCanvas.width && y + j < srcCanvas.height) {
                dstPixels[(y + j) * srcCanvas.width + (x + i)] = srcPixels[srcIdx];
              }
            }
          }
        }
      }
    }

    dstCtx.putImageData(dstData, 0, 0);
  };

  const animate = () => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d');
    const offscreenCtx = offscreen.getContext('2d');
    if (!ctx || !offscreenCtx) return;

    const now = Date.now();
    const elapsed = (now - startTimeRef.current) * speed;

    renderTextPattern(offscreenCtx, elapsed, offscreen.width, offscreen.height);
    transformToSpiral(offscreen, ctx, elapsed, canvas.width, canvas.height);

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', initCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [text, speed, bgColor, textColor]);

  const generateWebM = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    setExportProgress(0);

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spiral-funnel.webm';
      a.click();
      setIsExporting(false);
    };

    recorder.start();
    
    // Record for exactly one loop duration
    setTimeout(() => {
      recorder.stop();
    }, loopDuration / speed);
  };

  const generateGIF = async () => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    setIsExporting(true);
    setExportProgress(0);

    // Pause main animation
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
    });

    const fps = 20;
    const frameCount = (loopDuration / 1000) * fps;
    const frameDelay = 1000 / fps;

    const ctx = canvas.getContext('2d');
    const offscreenCtx = offscreen.getContext('2d');
    if (!ctx || !offscreenCtx) return;

    for (let i = 0; i < frameCount; i++) {
      const time = (i / frameCount) * loopDuration;
      renderTextPattern(offscreenCtx, time, offscreen.width, offscreen.height);
      transformToSpiral(offscreen, ctx, time, canvas.width, canvas.height);
      
      // Add frame to GIF
      gif.addFrame(ctx, { copy: true, delay: frameDelay });
      setExportProgress(Math.round((i / frameCount) * 50));
      
      // Small delay to keep UI responsive
      await new Promise(r => setTimeout(r, 10));
    }

    gif.on('progress', (p: number) => {
      setExportProgress(50 + Math.round(p * 50));
    });

    gif.on('finished', (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spiral-funnel.gif';
      a.click();
      setIsExporting(false);
      // Resume animation
      requestRef.current = requestAnimationFrame(animate);
    });

    gif.render();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />
      
      {/* Hidden offscreen canvas */}
      <canvas ref={offscreenCanvasRef} className="hidden" />

      {/* UI Overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl pointer-events-auto flex flex-col gap-6">
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-white/50" />
              <h1 className="text-white font-semibold tracking-tight">Spiral Funnel Controls</h1>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Display Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  placeholder="Enter text..."
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Animation Speed</label>
                <div className="flex items-center gap-4 h-[42px]">
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-white"
                  />
                  <span className="text-white font-mono text-sm w-8">{speed.toFixed(1)}x</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Background</label>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer"
                  />
                  <span className="text-white/60 text-xs font-mono uppercase">{bgColor}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Text Color</label>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer"
                  />
                  <span className="text-white/60 text-xs font-mono uppercase">{textColor}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={generateGIF}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-2xl hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              GIF
            </button>
            <button
              onClick={generateWebM}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white font-bold py-3 rounded-2xl hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 border border-white/10"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              WebM
            </button>
          </div>
        </div>
      </div>

      {/* Export Progress Overlay */}
      {isExporting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-64 flex flex-col gap-4 text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
            <h2 className="text-white font-bold text-xl">Exporting...</h2>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-300" 
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <p className="text-white/40 text-sm font-medium uppercase tracking-widest">{exportProgress}% Complete</p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ARButton, XR } from '@react-three/xr';
import { DeviceOrientationControls } from '@react-three/drei';
import { DrawingCanvas } from './components/DrawingCanvas';
import { VideoBackground } from './components/VideoBackground';
import { initializeHandLandmarker, detectHands } from './services/visionService';
import { DrawMode } from './types';

const COLORS = [
  { name: '红色', hex: '#ef4444', bg: 'bg-red-500' },
  { name: '蓝色', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: '绿色', hex: '#22c55e', bg: 'bg-green-500' },
  { name: '黄色', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: '紫色', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: '黑色', hex: '#1e293b', bg: 'bg-slate-800' },
];

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [handPos, setHandPos] = useState<{ x: number, y: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [clearTrigger, setClearTrigger] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0].hex);
  const [isMirrored, setIsMirrored] = useState(true);
  const [lineWidth, setLineWidth] = useState(8);
  const [drawMode, setDrawMode] = useState<DrawMode>(DrawMode.DRAWING);

  useEffect(() => {
    initializeHandLandmarker().then(() => setModelLoaded(true));
  }, []);

  useEffect(() => {
    if (!modelLoaded || !videoElement || !isStarted) return;

    let animationFrameId: number;
    let lastProcessedTime = -1;

    const loop = () => {
      try {
        if (
          videoElement.readyState >= 2 && 
          videoElement.videoWidth > 0 && 
          videoElement.videoHeight > 0
        ) {
          const now = performance.now();
          if (now - lastProcessedTime > 30) { 
             const result = detectHands(videoElement, now);
             lastProcessedTime = now;

             if (result && result.landmarks && result.landmarks.length > 0) {
                const landmarks = result.landmarks[0];
                const indexTip = landmarks[8];
                const thumbTip = landmarks[4];
                const x = isMirrored ? (1 - indexTip.x) : indexTip.x;
                setHandPos({ x, y: indexTip.y });
                const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
                setIsPinching(distance < 0.08); 
              } else {
                setHandPos(null);
                setIsPinching(false);
              }
          }
        }
      } catch (error) {
        console.warn("CV Loop Error:", error);
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [modelLoaded, videoElement, isStarted, isMirrored]);

  const handleStart = async () => {
    if (typeof (DeviceOrientationEvent as any) !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        await (DeviceOrientationEvent as any).requestPermission();
        setIsStarted(true);
      } catch (e) {
        setIsStarted(true);
      }
    } else {
      setIsStarted(true);
    }
  };

  const handleClear = () => {
    if (confirm("确定要清空所有笔迹吗？")) {
      setClearTrigger(prev => prev + 1);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isStarted) return;
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    setMousePos({ x, y });
  };

  return (
    <div 
      className="relative w-full h-screen bg-slate-900 overflow-hidden text-slate-800 touch-none select-none"
      onPointerMove={handlePointerMove}
      onPointerDown={() => setIsMouseDown(true)}
      onPointerUp={() => setIsMouseDown(false)}
    >
      {isStarted && <VideoBackground onVideoReady={setVideoElement} isMirrored={isMirrored} />}

      <div id="ui-root" className="absolute inset-0 z-10 pointer-events-none flex flex-col overflow-hidden safe-top safe-bottom safe-left safe-right">
        {isStarted ? (
          <div className="flex-1 relative flex flex-col p-4 md:p-6">
             {/* 3D 渲染层 */}
             <div className="absolute inset-0 pointer-events-none">
                <Canvas className="w-full h-full" camera={{ fov: 60 }}>
                  <XR>
                    <DeviceOrientationControls />
                    <DrawingCanvas 
                      handPosition={handPos} 
                      isPinching={isPinching}
                      mousePosition={mousePos}
                      isMouseDown={isMouseDown}
                      clearTrigger={clearTrigger}
                      activeColor={currentColor}
                      lineWidth={lineWidth}
                      drawMode={drawMode}
                     />
                  </XR>
                </Canvas>
             </div>

             {/* UI 交互层 */}
             {/* 顶部状态栏 */}
             <div className="relative flex justify-between items-start pointer-events-auto z-20">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsMirrored(!isMirrored)}
                      className={`h-11 px-4 rounded-xl border-2 transition-all flex items-center gap-2 font-bold text-sm backdrop-blur-xl shadow-xl
                        ${isMirrored ? 'bg-teal-500/80 border-white/40 text-white' : 'bg-white/40 border-teal-500/50 text-teal-900'}`}
                    >
                      {isMirrored ? "🪞 镜像开启" : "🖼️ 常规模式"}
                    </button>
                    <button 
                      onClick={handleClear}
                      className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/30 border-2 border-white/20 backdrop-blur-xl text-lg shadow-xl hover:bg-red-500 transition-all text-white active:scale-90"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="hidden md:flex bg-white/10 border border-white/20 backdrop-blur-md px-5 py-2 rounded-2xl flex-col items-center shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">空中画板</span>
                  <span className="text-xs font-bold text-white tracking-wide">专业版 v1.5</span>
                </div>

                <div className={`h-11 px-4 rounded-xl backdrop-blur-xl border border-white/20 flex items-center gap-3 transition-all shadow-xl
                  ${(handPos || isMouseDown) ? 'bg-white/40' : 'bg-black/20 text-white/40'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${(handPos || isMouseDown) ? (isPinching || isMouseDown ? 'bg-green-400 animate-pulse' : 'bg-yellow-400') : 'bg-slate-500'}`}></div>
                  <span className="text-xs font-bold text-white">
                    {drawMode === DrawMode.ERASING ? "橡皮擦" : ((handPos || isMouseDown) ? (isPinching || isMouseDown ? "正在书写" : "准备就绪") : "等待手部...")}
                  </span>
                </div>
             </div>

             {/* 左侧工具栏 - 响应式高度适配 */}
             <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto z-20">
                <div className="flex flex-col gap-2 p-1.5 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-xl shadow-2xl">
                  <button
                    onClick={() => setDrawMode(DrawMode.DRAWING)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${drawMode === DrawMode.DRAWING ? 'bg-teal-500 text-white scale-110 shadow-lg' : 'bg-white/40 text-teal-900 opacity-60'}`}
                    title="画笔"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDrawMode(DrawMode.ERASING)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${drawMode === DrawMode.ERASING ? 'bg-red-500 text-white scale-110 shadow-lg' : 'bg-white/40 text-red-900 opacity-60'}`}
                    title="橡皮擦"
                  >
                    🧽
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 p-1.5 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-xl shadow-2xl overflow-y-auto max-h-[40vh]">
                  {COLORS.map((color) => (
                    <button
                      key={color.hex}
                      onClick={() => {
                        setCurrentColor(color.hex);
                        setDrawMode(DrawMode.DRAWING);
                      }}
                      className={`w-10 h-10 rounded-full border-4 transition-all ${color.bg} 
                        ${currentColor === color.hex && drawMode === DrawMode.DRAWING ? 'border-white scale-110 shadow-lg' : 'border-white/10'}`}
                    />
                  ))}
                </div>
             </div>

             {/* 右侧粗细调节 - 优化滑块体验 */}
             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto z-20 flex flex-col items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-xl shadow-2xl flex flex-col items-center">
                  <div className="h-32 flex items-center justify-center mb-2">
                    <input 
                      type="range" 
                      min="2" 
                      max="60" 
                      step="1"
                      value={lineWidth} 
                      onChange={(e) => setLineWidth(parseInt(e.target.value))}
                      className="appearance-none h-28 w-1.5 bg-white/30 rounded-full outline-none cursor-pointer accent-teal-400"
                      style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                    />
                  </div>
                  <span className="text-[10px] font-black text-white bg-teal-500 px-1.5 py-0.5 rounded-md shadow-sm">{lineWidth}</span>
                </div>
             </div>

             {/* 底部 AR 入口 */}
             <div className="mt-auto flex flex-col items-center gap-3 pointer-events-auto pb-4 z-20">
                <ARButton 
                  className="!static !bg-gradient-to-r from-teal-400 to-emerald-500 !text-white !font-black !py-3.5 !px-10 !rounded-full !shadow-2xl !border-2 !border-white/50 !transition-all !hover:scale-105 !active:scale-95 !cursor-pointer !uppercase !tracking-widest !text-xs"
                  sessionInit={{ 
                    optionalFeatures: ['hit-test', 'dom-overlay', 'local-floor'], 
                    domOverlay: { root: document.getElementById('ui-root')! } 
                  }}
                >
                  进入 AR 实景创作
                </ARButton>
                <div className="text-[10px] text-white/50 font-bold tracking-widest bg-black/20 px-3 py-1 rounded-full">点击上方按钮启动空间追踪</div>
             </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 z-50 pointer-events-auto">
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/20 rounded-full blur-3xl animate-pulse"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-400/30 rounded-full blur-3xl"></div>

             <div className="text-center p-8 max-w-md z-10">
               <div className="text-8xl mb-6 drop-shadow-2xl animate-bounce">🖌️</div>
               <h1 className="text-5xl font-black text-white mb-4 tracking-tighter drop-shadow-lg">空中画板</h1>
               <p className="text-teal-50 text-lg mb-10 font-medium opacity-90 leading-relaxed">
                 体验指尖绘画的魅力，在真实空间中创作属于你的 3D 艺术杰作。
               </p>
               <button 
                 onClick={handleStart}
                 disabled={!modelLoaded}
                 className={`relative text-xl font-black py-5 px-14 rounded-2xl shadow-2xl transition-all transform active:translate-y-1 active:shadow-none overflow-hidden
                   ${modelLoaded ? 'bg-white text-teal-600 hover:scale-105' : 'bg-white/50 text-white cursor-not-allowed'}`}
               >
                 {modelLoaded ? (
                   <>
                    <span className="relative z-10 tracking-widest">启动魔法画板</span>
                    <div className="absolute inset-0 bg-teal-100 opacity-0 hover:opacity-100 transition-opacity"></div>
                   </>
                 ) : (
                   <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      正在同步资源...
                   </div>
                 )}
               </button>
               <div className="mt-8 text-white/60 text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                 <div className="w-1 h-1 bg-white/40 rounded-full"></div>
                 需要相机与传感器访问权限
                 <div className="w-1 h-1 bg-white/40 rounded-full"></div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
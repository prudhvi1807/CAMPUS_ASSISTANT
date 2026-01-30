
import React, { useRef, useEffect, useState, useCallback } from 'react';

export type CameraMode = 'locate' | 'destination';

interface CameraViewProps {
  onCapture: (base64: string, mode: CameraMode) => void;
  isProcessing: boolean;
  activeMode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, isProcessing, activeMode, onModeChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    setupCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        onCapture(base64, activeMode);
      }
    }
  }, [onCapture, activeMode]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Mode Selector Overlay */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10 z-40">
        <button 
          onClick={() => onModeChange('locate')}
          className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${activeMode === 'locate' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
        >
          LOCATE ME
        </button>
        <button 
          onClick={() => onModeChange('destination')}
          className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${activeMode === 'destination' ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'text-slate-400'}`}
        >
          SCAN SIGN
        </button>
      </div>

      {/* AR Viewport Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[20px] border-white/10 flex flex-col items-center justify-center">
        <div className={`w-72 h-72 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-colors duration-500 ${activeMode === 'locate' ? 'border-cyan-400/50' : 'border-rose-400/80 shadow-[inset_0_0_40px_rgba(244,63,94,0.1)]'}`}>
            <div className={`p-2 rounded-lg bg-black/50 backdrop-blur-md mb-2 flex items-center gap-2 border ${activeMode === 'locate' ? 'border-cyan-400/30' : 'border-rose-400/50'}`}>
               <div className={`w-2 h-2 rounded-full animate-pulse ${activeMode === 'locate' ? 'bg-cyan-400' : 'bg-rose-500'}`} />
               <p className={`text-[10px] font-black font-mono tracking-tighter ${activeMode === 'locate' ? 'text-cyan-400' : 'text-rose-400'}`}>
                 {activeMode === 'locate' ? 'ANALYZING ENVIRONMENT' : 'SCANNING FOR SIGNAGE'}
               </p>
            </div>
            {activeMode === 'destination' && (
              <p className="text-[9px] text-white/40 uppercase font-bold text-center px-4 leading-tight">
                Point at a room number, office sign, or building entrance plaque
              </p>
            )}
        </div>
      </div>

      <button
        onClick={handleCapture}
        disabled={isProcessing}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-[6px] shadow-2xl flex items-center justify-center transition-all active:scale-90 ${isProcessing ? 'border-gray-500 bg-gray-600' : activeMode === 'locate' ? 'border-white bg-cyan-500' : 'border-white bg-rose-500 shadow-rose-500/40'}`}
      >
        {isProcessing ? (
          <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
        ) : (
          <i className={`fas ${activeMode === 'locate' ? 'fa-location-dot text-slate-950' : 'fa-door-open text-white'} text-2xl`}></i>
        )}
      </button>

      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/20">
        <h2 className="text-white text-xs font-black flex items-center gap-2 uppercase tracking-tighter">
            <i className={`fas ${activeMode === 'locate' ? 'fa-camera text-cyan-400' : 'fa-magnifying-glass text-rose-400'}`}></i>
            {activeMode === 'locate' ? 'Visual Positioning' : 'Intelligent Sign Reader'}
        </h2>
      </div>
    </div>
  );
};

export default CameraView;

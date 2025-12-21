
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraViewProps {
  onCapture: (base64: string) => void;
  isProcessing: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, isProcessing }) => {
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
        onCapture(base64);
      }
    }
  }, [onCapture]);

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

      {/* AR Viewport Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[20px] border-white/10 flex items-center justify-center">
        <div className="w-64 h-64 border-2 border-dashed border-cyan-400/50 rounded-lg flex flex-col items-center justify-center">
            <p className="text-cyan-400 text-xs font-mono bg-black/50 px-2 py-1">SCANNING ENVIRONMENT</p>
        </div>
      </div>

      <button
        onClick={handleCapture}
        disabled={isProcessing}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 ${isProcessing ? 'border-gray-500 bg-gray-600' : 'border-white bg-red-500'} shadow-lg flex items-center justify-center transition-all active:scale-90`}
      >
        {isProcessing ? (
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-white/50" />
        )}
      </button>

      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/20">
        <h2 className="text-white font-bold flex items-center gap-2">
            <i className="fas fa-camera text-cyan-400"></i>
            Live Vision
        </h2>
      </div>
    </div>
  );
};

export default CameraView;


import React, { useMemo } from 'react';
import { NavigationStep, MovementData } from '../types';

interface NavigationOverlayProps {
  steps: NavigationStep[];
  currentStepIndex: number;
  isAccessibilityMode: boolean;
  movement: MovementData;
}

const NavigationOverlay: React.FC<NavigationOverlayProps> = ({ steps, currentStepIndex, isAccessibilityMode, movement }) => {
  const currentStep = steps[currentStepIndex];

  if (!currentStep) return null;

  // Calculate high-fidelity AR arrow rotation
  const rotation = useMemo(() => {
    let baseRotation = 0;
    if (currentStep.direction === 'left') baseRotation = -90;
    if (currentStep.direction === 'right') baseRotation = 90;
    if (currentStep.direction === 'arrive') return 0;
    
    /**
     * Spatial Feedback Simulation:
     * We modulate the rotation slightly based on the user's bearing to simulate 
     * a 3D arrow that is 'aware' of the direction it is pointing in space.
     * Even small head/phone movements will now result in subtle arrow swiveling.
     */
    const responsiveSwivel = (movement.bearing % 15) - 7.5; 
    return baseRotation - responsiveSwivel;
  }, [currentStep.direction, movement.bearing]);

  const renderARArrow = () => {
    const isStationary = movement.status === 'Stationary';
    const colorClass = movement.status === 'Moving' ? 'text-cyan-400' : 'text-cyan-600/60';
    const accessibilityColor = 'text-yellow-400';

    if (currentStep.direction === 'arrive') {
      return (
        <div className="animate-bounce">
          <i className={`fas fa-location-dot ${isAccessibilityMode ? 'text-[12rem] text-yellow-400' : 'text-8xl text-emerald-400'} drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]`}></i>
        </div>
      );
    }

    return (
      <div 
        className="transition-transform duration-500 ease-out flex flex-col items-center"
        style={{ transform: `perspective(800px) rotateX(55deg) rotateZ(${rotation}deg)` }}
      >
        <div className={`relative transition-all duration-700 ${isAccessibilityMode ? 'scale-150' : 'scale-110'} ${isStationary ? 'animate-[pulse_3s_infinite]' : ''}`}>
          {/* Main Arrow Body */}
          <i className={`fas fa-chevron-up ${isAccessibilityMode ? accessibilityColor : colorClass} text-[10rem] drop-shadow-[0_20px_40px_rgba(34,211,238,0.5)]`}></i>
          
          {/* Movement Trails / Ping Effect */}
          {movement.status === 'Moving' && (
             <div className="absolute inset-0 animate-ping opacity-30">
               <i className={`fas fa-chevron-up ${isAccessibilityMode ? accessibilityColor : colorClass} text-[10rem]`}></i>
             </div>
          )}
          
          {/* Inner Glow for Depth */}
          <div className="absolute inset-0 flex items-center justify-center opacity-40">
             <i className="fas fa-chevron-up text-white text-[8rem] blur-sm"></i>
          </div>
        </div>

        {/* Dynamic Shadow on the "Ground" */}
        <div className={`mt-8 h-2 w-48 blur-xl rounded-full transition-opacity duration-500 ${isAccessibilityMode ? 'bg-yellow-400/20' : 'bg-cyan-400/30'} ${isStationary ? 'opacity-40 scale-90' : 'opacity-100 scale-100'}`}></div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center">
      {/* Dynamic AR Viewport */}
      <div className="flex-1 flex items-center justify-center mt-20 perspective-1000">
        {renderARArrow()}
      </div>
      
      {/* HUD Instruction Card */}
      <div className={`w-full ${isAccessibilityMode ? 'max-w-2xl pb-32' : 'max-w-sm pb-24'} px-6`}>
        <div className={`
          backdrop-blur-2xl p-6 rounded-[40px] border shadow-2xl relative overflow-hidden transition-all duration-700
          ${isAccessibilityMode ? 'bg-black border-yellow-400 border-4' : 'bg-slate-900/95 border-white/10'}
          ${movement.status === 'Moving' ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-90 scale-[0.98]'}
        `}>
          {/* Scanning Progress Bar Effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
            <div className={`h-full animate-[shimmer_2s_infinite] ${isAccessibilityMode ? 'bg-yellow-400' : 'bg-cyan-500'}`} style={{ width: '40%' }}></div>
          </div>

          <div className="flex justify-between items-start mb-4">
             <div className="flex flex-col">
                <span className={`px-3 py-0.5 rounded-full font-black uppercase tracking-widest inline-flex items-center gap-2 ${isAccessibilityMode ? 'bg-yellow-400 text-black text-sm' : 'bg-cyan-500/10 text-cyan-400 text-[9px]'}`}>
                  {movement.status === 'Moving' ? (
                    <i className="fas fa-person-walking animate-bounce"></i>
                  ) : (
                    <i className="fas fa-street-view opacity-50"></i>
                  )}
                  {currentStep.direction === 'arrive' ? 'Destination' : `Targeting Step ${currentStepIndex + 1}`}
                </span>
             </div>
             <div className="flex flex-col items-end">
                <span className={`${isAccessibilityMode ? 'text-yellow-400 text-xl' : 'text-slate-500 text-[10px]'} font-mono font-bold flex items-center gap-1`}>
                  <i className="fas fa-compass text-[8px] opacity-40"></i>
                  {movement.bearing.toFixed(0)}° HEADING
                </span>
             </div>
          </div>
          
          <h3 className={`font-black leading-tight mb-3 ${isAccessibilityMode ? 'text-white text-4xl' : 'text-white text-2xl tracking-tight'}`}>
            {currentStep.instruction}
          </h3>
          
          {/* Step Progress Indicators */}
          <div className="mt-6 flex gap-2 justify-start items-center">
              {steps.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i === currentStepIndex ? 'w-16 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : i < currentStepIndex ? 'w-4 bg-yellow-400/40' : 'w-2 bg-white/10'}`} />
              ))}
              <span className="ml-2 text-[8px] font-black text-slate-600 uppercase tracking-tighter">Path progress</span>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry HUD (Bottom Right) */}
      <div className="absolute bottom-6 right-6 bg-black/90 backdrop-blur-xl p-4 rounded-3xl border border-white/10 pointer-events-none font-mono text-cyan-400/90 leading-none shadow-2xl scale-90 origin-bottom-right">
        <div className="flex items-center gap-3 mb-3 border-b border-white/5 pb-2">
          <div className={`w-2 h-2 rounded-full ${movement.status === 'Moving' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
          <span className="font-black text-[10px] uppercase tracking-widest">AR Core Telemetry</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[8px] uppercase font-bold text-slate-400">
           <span>Status:</span> <span className="text-white text-right">{movement.status}</span>
           <span>Velocity:</span> <span className="text-white text-right">{movement.speed.toFixed(2)} m/s</span>
           <span>Azimuth:</span> <span className="text-white text-right">{movement.bearing.toFixed(1)}°</span>
           <span>Engine:</span> <span className="text-cyan-500 text-right">LOCALHOST_AI</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}} />
    </div>
  );
};

export default NavigationOverlay;

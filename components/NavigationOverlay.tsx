
import React from 'react';
import { NavigationStep } from '../types';

interface NavigationOverlayProps {
  steps: NavigationStep[];
  currentStepIndex: number;
  isAccessibilityMode: boolean;
}

const NavigationOverlay: React.FC<NavigationOverlayProps> = ({ steps, currentStepIndex, isAccessibilityMode }) => {
  const currentStep = steps[currentStepIndex];

  if (!currentStep) return null;

  const renderArrow = () => {
    const arrowClass = isAccessibilityMode 
      ? "text-[12rem] text-yellow-400 drop-shadow-[0_0_20px_rgba(0,0,0,1)] font-black"
      : "text-8xl text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]";

    switch (currentStep.direction) {
      case 'left': return <i className={`fas fa-long-arrow-alt-left ${arrowClass} animate-pulse`}></i>;
      case 'right': return <i className={`fas fa-long-arrow-alt-right ${arrowClass} animate-pulse`}></i>;
      case 'straight': return <i className={`fas fa-long-arrow-alt-up ${arrowClass} animate-bounce`}></i>;
      case 'arrive': return <i className={`fas fa-map-marker-alt ${isAccessibilityMode ? "text-[12rem] text-yellow-400" : "text-8xl text-emerald-400"} animate-bounce`}></i>;
      default: return null;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
      {/* Visual Direction Indicator */}
      <div className={`mb-20 transform -rotate-x-12 ${isAccessibilityMode ? 'scale-125' : ''}`}>
        {renderArrow()}
      </div>
      
      <div className={`w-full ${isAccessibilityMode ? 'max-w-2xl' : 'max-w-sm'} px-6`}>
        <div className={`
          backdrop-blur-xl p-6 rounded-[32px] border shadow-2xl relative overflow-hidden
          ${isAccessibilityMode ? 'bg-black border-yellow-400 border-4' : 'bg-slate-900/80 border-white/10'}
        `}>
          <div className={`absolute top-0 left-0 w-2 h-full ${isAccessibilityMode ? 'bg-yellow-400' : 'bg-cyan-500'}`}></div>
          
          <div className="flex justify-between items-start mb-3">
             <span className={`px-3 py-1 rounded-full font-black uppercase tracking-widest ${isAccessibilityMode ? 'bg-yellow-400 text-black text-lg' : 'bg-cyan-500/10 text-cyan-400 text-[10px]'}`}>
               Step {currentStepIndex + 1}
             </span>
             {currentStep.distance && (
               <span className={`${isAccessibilityMode ? 'text-yellow-400 text-xl' : 'text-slate-400 text-xs'} font-bold`}>{currentStep.distance}</span>
             )}
          </div>
          
          <h3 className={`font-bold leading-tight mb-2 ${isAccessibilityMode ? 'text-white text-3xl font-black' : 'text-white text-xl'}`}>
            {currentStep.instruction}
          </h3>
          
          {currentStep.landmark && (
            <p className={`font-medium italic ${isAccessibilityMode ? 'text-yellow-400 text-xl' : 'text-cyan-400/80 text-xs'}`}>
              <i className="fas fa-info-circle mr-1"></i> Landmark: {currentStep.landmark}
            </p>
          )}

          <div className="mt-6 flex gap-1.5 justify-start">
              {steps.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i === currentStepIndex ? 'w-12 bg-yellow-400' : i < currentStepIndex ? 'w-4 bg-yellow-400/30' : 'w-2 bg-white/10'}`} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationOverlay;

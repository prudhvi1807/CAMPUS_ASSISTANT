
import React from 'react';
import { NavigationStep } from '../types';

interface NavigationOverlayProps {
  steps: NavigationStep[];
  currentStepIndex: number;
}

const NavigationOverlay: React.FC<NavigationOverlayProps> = ({ steps, currentStepIndex }) => {
  const currentStep = steps[currentStepIndex];

  if (!currentStep) return null;

  const renderArrow = () => {
    switch (currentStep.direction) {
      case 'left': return <i className="fas fa-arrow-left text-6xl text-cyan-400 animate-pulse"></i>;
      case 'right': return <i className="fas fa-arrow-right text-6xl text-cyan-400 animate-pulse"></i>;
      case 'straight': return <i className="fas fa-arrow-up text-6xl text-cyan-400 animate-bounce"></i>;
      case 'arrive': return <i className="fas fa-check-circle text-6xl text-green-400 animate-bounce"></i>;
      default: return null;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-6">
      <div className="mb-12">
        {renderArrow()}
      </div>
      
      <div className="bg-black/70 backdrop-blur-lg p-6 rounded-2xl border border-white/20 w-full max-w-sm text-center shadow-2xl">
        <p className="text-cyan-400 uppercase tracking-widest text-xs font-bold mb-1">Current Instruction</p>
        <h3 className="text-white text-xl font-semibold leading-tight">
          {currentStep.instruction}
        </h3>
        <div className="mt-4 flex gap-1 justify-center">
            {steps.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all ${i <= currentStepIndex ? 'w-6 bg-cyan-400' : 'w-2 bg-white/20'}`} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default NavigationOverlay;


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CAMPUS_NODES, CAMPUS_EDGES } from './constants';
import { NavigationStep, ChatMessage, DetectionResult, LocationMetadata, LocationProfile, MovementData } from './types';
import { GeminiService } from './services/geminiService';
import { findShortestPath } from './services/pathfinding';
import CameraView, { CameraMode } from './components/CameraView';
import NavigationOverlay from './components/NavigationOverlay';
import CampusMap from './components/CampusMap';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'camera' | 'map' | 'train'>('camera');
  const [cameraMode, setCameraMode] = useState<CameraMode>('locate');
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<DetectionResult | null>(null);
  const [pendingDestination, setPendingDestination] = useState<DetectionResult | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [aiInstructions, setAiInstructions] = useState<string[]>([]);
  const [arrivalStatus, setArrivalStatus] = useState<'none' | 'verifying' | 'confirmed'>('none');
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);

  // Movement & Orientation Engine State
  const [movement, setMovement] = useState<MovementData>({
    status: 'Stationary',
    bearing: 0,
    speed: 0
  });

  // Training State
  const [trainingImages, setTrainingImages] = useState<string[]>([]);
  const [trainingMetadata, setTrainingMetadata] = useState<LocationMetadata>({
    name: '',
    block: '',
    floor: '',
    type: 'entrance'
  });
  const [learnedProfile, setLearnedProfile] = useState<LocationProfile | null>(null);

  const gemini = useMemo(() => new GeminiService(), []);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Movement Engine
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        setMovement(prev => ({ ...prev, bearing: e.alpha }));
      }
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity;
      if (accel) {
        const totalMotion = Math.abs(accel.x || 0) + Math.abs(accel.y || 0) + Math.abs(accel.z || 0);
        const isMoving = totalMotion > 13; // Threshold for walking detection
        setMovement(prev => ({
          ...prev,
          status: isMoving ? 'Moving' : 'Stationary',
          speed: totalMotion / 10 // Simplified mapping
        }));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
    
    // Simulate movement for localhost development if sensors aren't active
    const simInterval = setInterval(() => {
      setMovement(prev => {
        if (prev.bearing === 0 && prev.status === 'Stationary') {
            return { ...prev, bearing: (prev.bearing + 0.5) % 360 };
        }
        return prev;
      });
    }, 100);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
      clearInterval(simInterval);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (showChat) {
      scrollToBottom();
    }
  }, [messages, showChat]);

  const resetNav = () => {
    setDestinationId(null);
    setPath([]);
    setAiInstructions([]);
    setArrivalStatus('none');
    setCurrentStepIndex(0);
  };

  const playTTS = useCallback(async (text: string) => {
    if (!isAccessibilityMode) return;
    const base64Audio = await gemini.generateSpeech(text);
    if (!base64Audio) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, [gemini, isAccessibilityMode]);

  useEffect(() => {
    if (currentLocationId && destinationId) {
      const newPath = findShortestPath(currentLocationId, destinationId);
      setPath(newPath);
      setCurrentStepIndex(0);
      setArrivalStatus('none');
      
      const pathNames = newPath.map(id => CAMPUS_NODES.find(n => n.id === id)?.name || id);
      gemini.getDynamicInstructions(pathNames, isAccessibilityMode).then(steps => {
        setAiInstructions(steps);
        if (steps.length > 0) playTTS(steps[0]);
      });
    }
  }, [currentLocationId, destinationId, gemini, isAccessibilityMode, playTTS]);

  const handleVisionCapture = useCallback(async (base64: string, mode: CameraMode) => {
    if (viewMode === 'train') {
      setTrainingImages(prev => [...prev, base64]);
      playTTS(`Area visual feature captured.`);
      return;
    }

    setIsProcessing(true);
    
    if (path.length > 0 && currentStepIndex >= path.length - 1) {
      setArrivalStatus('verifying');
      const destName = CAMPUS_NODES.find(n => n.id === destinationId)?.name || 'Destination';
      const verification = await gemini.verifyArrival(base64, destName);
      setIsProcessing(false);
      if (verification.arrived && verification.confidence > 0.6) {
        setArrivalStatus('confirmed');
        const arrivalText = `Destination Reached! Verified at ${destName}.`;
        setMessages(prev => [...prev, { role: 'model', text: arrivalText }]);
        playTTS(arrivalText);
      } else {
        setArrivalStatus('none');
        const retryText = "Arrival unconfirmed. Check your proximity.";
        setMessages(prev => [...prev, { role: 'model', text: retryText }]);
        playTTS(retryText);
      }
      return;
    }

    if (mode === 'destination') {
      const result = await gemini.detectDestination(base64);
      setIsProcessing(false);
      if (result) {
        if (result.confidence > 0.8) {
          setDestinationId(result.locationId);
          setPendingDestination(null);
          const foundText = `Target Locked: ${CAMPUS_NODES.find(n => n.id === result.locationId)?.name}.`;
          setMessages(prev => [...prev, { role: 'model', text: foundText }]);
          playTTS(foundText);
        } else {
          setPendingDestination(result);
        }
      }
    } else {
      const result = await gemini.detectLocation(base64);
      setIsProcessing(false);
      if (result) {
        if (result.confidence > 0.75) {
          setCurrentLocationId(result.locationId);
          setPendingLocation(null);
          const locText = `Location Sync: ${CAMPUS_NODES.find(n => n.id === result.locationId)?.name}.`;
          setMessages(prev => [...prev, { role: 'model', text: locText }]);
          playTTS(locText);
        } else {
          setPendingLocation(result);
        }
      }
    }
  }, [gemini, path, currentStepIndex, destinationId, currentLocationId, playTTS, viewMode]);

  const handleStartTraining = async () => {
    if (!trainingMetadata.name || trainingImages.length === 0) {
      alert("Missing metadata or images.");
      return;
    }
    setIsProcessing(true);
    try {
      const features = await gemini.trainLocation(trainingImages, trainingMetadata);
      setLearnedProfile({
        ...trainingMetadata,
        id: 'new-' + Date.now(),
        learnedFeatures: features,
        imageCount: trainingImages.length
      });
      playTTS(`Training successful for ${trainingMetadata.name}. Ready for navigation.`);
    } catch (e) {
      alert("Training error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isProcessing) return;
    const userMessage = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsProcessing(true);
    const aiResponse = await gemini.chat(userMessage, messages);
    setIsProcessing(false);
    setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
    if (isAccessibilityMode) playTTS(aiResponse);
  };

  const navigationSteps = useMemo<NavigationStep[]>(() => {
    if (path.length < 2) return [];
    return aiInstructions.map((text, i) => ({
      instruction: text,
      direction: (i === aiInstructions.length - 1 ? 'arrive' : 'straight') as NavigationStep['direction']
    }));
  }, [aiInstructions, path]);

  const nextStep = () => {
    if (currentStepIndex < navigationSteps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      if (navigationSteps[newIndex]) playTTS(navigationSteps[newIndex].instruction);
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans transition-colors duration-500 ${isAccessibilityMode ? 'bg-black text-white' : 'bg-slate-950 text-slate-100'}`}>
      <header className={`absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start backdrop-blur-sm ${isAccessibilityMode ? 'border-b border-yellow-400' : ''}`}>
        <div className="flex flex-col">
          <h1 className={`${isAccessibilityMode ? 'text-4xl' : 'text-2xl'} font-black tracking-tighter text-white flex items-center gap-2`}>
            <span className={`${isAccessibilityMode ? 'bg-yellow-400 text-black' : 'bg-cyan-500 text-slate-950'} px-2 py-0.5 rounded italic`}>AI</span>
            CAMPUS
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-3 h-3 rounded-full ${movement.status === 'Moving' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[9px] uppercase font-black tracking-tighter text-slate-400">{movement.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setViewMode(viewMode === 'train' ? 'camera' : 'train')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xl ${viewMode === 'train' ? 'bg-purple-500 border-purple-400' : 'bg-white/5 border-white/5'}`}>
                <i className="fas fa-brain text-white"></i>
            </button>
            <button onClick={() => setIsAccessibilityMode(!isAccessibilityMode)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xl ${isAccessibilityMode ? 'bg-yellow-400 text-black border-black' : 'bg-white/5 border-white/5'}`}>
                <i className="fas fa-universal-access text-xl"></i>
            </button>
            <button onClick={() => setViewMode(viewMode === 'camera' ? 'map' : 'camera')} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                <i className={`fas ${viewMode === 'camera' ? 'fa-map' : 'fa-video'} text-cyan-400`}></i>
            </button>
            <button onClick={() => setShowChat(!showChat)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                <i className="fas fa-comment-dots text-cyan-400"></i>
            </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {viewMode === 'train' ? (
          <div className="w-full h-full flex flex-col md:flex-row p-6 pt-28 gap-6 overflow-y-auto">
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-slate-900/50 border border-purple-500/30 p-8 rounded-[40px] backdrop-blur-xl">
                <h2 className="text-3xl font-black text-purple-400 mb-2 uppercase tracking-tighter">Learning Phase</h2>
                <div className="space-y-4 mt-6">
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-purple-500 outline-none" placeholder="Location Name" value={trainingMetadata.name} onChange={(e) => setTrainingMetadata({...trainingMetadata, name: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <input className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none" placeholder="Block" value={trainingMetadata.block} onChange={(e) => setTrainingMetadata({...trainingMetadata, block: e.target.value})} />
                    <input className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none" placeholder="Floor" value={trainingMetadata.floor} onChange={(e) => setTrainingMetadata({...trainingMetadata, floor: e.target.value})} />
                  </div>
                  <div className="p-4 bg-purple-500/10 border border-dashed border-purple-500/30 rounded-3xl flex gap-2 flex-wrap">
                    {trainingImages.map((img, i) => <img key={i} src={`data:image/jpeg;base64,${img}`} className="w-16 h-16 rounded-xl object-cover border border-purple-500" />)}
                    <button onClick={() => setViewMode('camera')} className="w-16 h-16 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-slate-500"><i className="fas fa-plus"></i></button>
                  </div>
                  <button onClick={handleStartTraining} disabled={isProcessing || trainingImages.length === 0} className="w-full py-5 bg-purple-600 rounded-3xl font-black text-lg disabled:opacity-50">INITIATE TRAINING</button>
                </div>
              </div>
            </div>
            {learnedProfile && (
              <div className="flex-1 bg-slate-900/80 border border-emerald-500/30 p-8 rounded-[40px] animate-in slide-in-from-right duration-500">
                <h3 className="text-emerald-400 font-black mb-1">LEARNING COMPLETE</h3>
                <h4 className="text-4xl font-black mb-6">{learnedProfile.name}</h4>
                <div className="p-6 bg-black/40 rounded-3xl border border-white/10 text-xs italic text-slate-300">
                  {learnedProfile.learnedFeatures}
                </div>
                <button onClick={() => setViewMode('camera')} className="w-full mt-6 py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black">START NAVIGATION</button>
              </div>
            )}
          </div>
        ) : viewMode === 'camera' ? (
          <div className="w-full h-full">
            <CameraView onCapture={handleVisionCapture} isProcessing={isProcessing} activeMode={cameraMode} onModeChange={setCameraMode} />
            {path.length > 0 && arrivalStatus !== 'confirmed' && (
                <div className="pointer-events-none">
                  <NavigationOverlay steps={navigationSteps} currentStepIndex={currentStepIndex} isAccessibilityMode={isAccessibilityMode} movement={movement} />
                  <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-between items-end pointer-events-auto">
                    <button onClick={resetNav} className={`w-16 h-16 border-4 rounded-3xl flex items-center justify-center ${isAccessibilityMode ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-rose-500/20 border-rose-500/50 text-rose-500'}`}><i className="fas fa-times text-xl"></i></button>
                    <div className="flex-1 px-4">
                      <button onClick={nextStep} className={`w-full py-6 rounded-3xl font-black shadow-xl flex items-center justify-center gap-4 ${isAccessibilityMode ? 'bg-yellow-400 text-black text-2xl' : 'bg-cyan-500 text-slate-950'}`}>
                        {currentStepIndex === navigationSteps.length - 1 ? 'ARRIVE' : 'NEXT STEP'}
                      </button>
                    </div>
                  </div>
                </div>
            )}
            {arrivalStatus === 'confirmed' && (
               <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                 <div className={`text-center p-10 border rounded-[40px] shadow-2xl max-w-sm ${isAccessibilityMode ? 'border-yellow-400 border-8' : 'border-emerald-500/50'}`}>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${isAccessibilityMode ? 'bg-yellow-400 text-black' : 'bg-emerald-500'}`}><i className="fas fa-check text-4xl"></i></div>
                    <h2 className="text-4xl font-black mb-4">ARRIVED</h2>
                    <button onClick={resetNav} className="w-full py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black">DONE</button>
                 </div>
               </div>
            )}
          </div>
        ) : (
          <div className={`w-full h-full p-6 pt-28 ${isAccessibilityMode ? 'bg-black' : 'bg-slate-950'}`}>
            <CampusMap currentLocationId={currentLocationId} destinationId={destinationId} path={path} onSelectNode={setDestinationId} />
            <div className="mt-8 space-y-4">
              <h3 className={`font-black uppercase tracking-widest ${isAccessibilityMode ? 'text-yellow-400 text-2xl' : 'text-slate-500 text-xs'}`}>Pick Destination</h3>
              <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[40vh]">
                  {CAMPUS_NODES.map(node => (
                      <button key={node.id} onClick={() => setDestinationId(node.id)} className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${destinationId === node.id ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'bg-slate-900 border-white/5 text-slate-400'}`}>
                        <i className={`fas ${node.type === 'lab' ? 'fa-flask' : 'fa-door-open'} text-xl`}></i>
                        <div className="text-left"><h4 className="font-black text-sm">{node.name}</h4><p className="text-[10px] opacity-60">{node.description}</p></div>
                      </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        <aside className={`absolute right-0 top-0 bottom-0 w-96 bg-black border-l z-[100] transition-transform duration-500 transform ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="font-black text-xl text-cyan-400">ASSISTANT</h2>
                    <button onClick={() => setShowChat(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><i className="fas fa-times"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-white/5 text-slate-300'}`}>{m.text}</div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-6 border-t border-white/5 flex gap-2">
                    <input className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none" placeholder="Ask anything..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                    <button onClick={handleSendMessage} className="w-14 h-14 bg-cyan-500 rounded-2xl flex items-center justify-center text-slate-950"><i className="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </aside>
      </main>

      <div className="p-4 bg-black/40 border-t border-white/5 flex justify-center gap-12 z-50">
          <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-600">BEARING</span><span className="text-[10px] font-bold text-cyan-400">{movement.bearing.toFixed(0)}°</span></div>
          <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-600">MOVEMENT</span><span className={`text-[10px] font-bold ${movement.status === 'Moving' ? 'text-emerald-500' : 'text-slate-500'}`}>{movement.status}</span></div>
          <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-600">PHASE</span><span className="text-[10px] font-bold text-purple-400">{viewMode === 'train' ? 'LEARN' : 'NAV'}</span></div>
      </div>
    </div>
  );
};

export default App;

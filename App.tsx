
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CAMPUS_NODES, CAMPUS_EDGES } from './constants';
import { NavigationStep, ChatMessage, DetectionResult, LocationMetadata, LocationProfile } from './types';
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
  const [showChat, setShowChat] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [aiInstructions, setAiInstructions] = useState<string[]>([]);
  const [arrivalStatus, setArrivalStatus] = useState<'none' | 'verifying' | 'confirmed'>('none');
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);

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
      playTTS(`Photo ${trainingImages.length + 1} added for learning.`);
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
        const arrivalText = `Destination Reached! You have arrived at ${destName}.`;
        setMessages(prev => [...prev, { role: 'model', text: arrivalText }]);
        playTTS(arrivalText);
      } else {
        setArrivalStatus('none');
        const retryText = "I can't confirm arrival yet. Please get closer to the entrance or sign.";
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
          const foundText = `Target Acquired: ${CAMPUS_NODES.find(n => n.id === result.locationId)?.name}.`;
          setMessages(prev => [...prev, { role: 'model', text: foundText }]);
          playTTS(foundText);
          if (!currentLocationId) {
            playTTS("I have your destination, but I'm not sure where you are yet. Use Locate Me mode.");
          }
        } else {
          setPendingDestination(result);
          playTTS("I found a potential destination. Please confirm on screen.");
        }
      }
    } else {
      const result = await gemini.detectLocation(base64);
      setIsProcessing(false);
      if (result) {
        if (result.confidence > 0.75) {
          setCurrentLocationId(result.locationId);
          setPendingLocation(null);
          const locText = `Location Identified: ${CAMPUS_NODES.find(n => n.id === result.locationId)?.name}.`;
          setMessages(prev => [...prev, { role: 'model', text: locText }]);
          playTTS(locText);
        } else {
          setPendingLocation(result);
          playTTS("I think I know where you are. Please confirm.");
        }
      }
    }
  }, [gemini, path, currentStepIndex, destinationId, currentLocationId, playTTS, viewMode, trainingImages.length]);

  const handleStartTraining = async () => {
    if (!trainingMetadata.name || trainingImages.length === 0) {
      alert("Please provide a name and at least one image.");
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
      playTTS(`Training completed for ${trainingMetadata.name}.`);
    } catch (e) {
      alert("Training failed. Check console.");
    } finally {
      setIsProcessing(false);
    }
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
      if (navigationSteps[newIndex]) {
        playTTS(navigationSteps[newIndex].instruction);
      }
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans transition-colors duration-500 ${isAccessibilityMode ? 'bg-black text-white' : 'bg-slate-950 text-slate-100'} selection:bg-cyan-500/30`}>
      <header className={`absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start backdrop-blur-sm ${isAccessibilityMode ? 'border-b border-yellow-400' : ''}`}>
        <div>
          <h1 className={`${isAccessibilityMode ? 'text-4xl' : 'text-2xl'} font-black tracking-tighter text-white flex items-center gap-2`}>
            <span className={`${isAccessibilityMode ? 'bg-yellow-400 text-black' : 'bg-cyan-500 text-slate-950'} px-2 py-0.5 rounded italic`}>AI</span>
            NAV
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-3 h-3 rounded-full ${currentLocationId ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <span className={`${isAccessibilityMode ? 'text-xl text-yellow-400' : 'text-[10px] text-slate-400'} uppercase font-bold tracking-widest`}>
              {currentLocationId ? CAMPUS_NODES.find(n => n.id === currentLocationId)?.name : 'Locating...'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                  setViewMode(viewMode === 'train' ? 'camera' : 'train');
                  if(viewMode !== 'train') {
                    setTrainingImages([]);
                    setLearnedProfile(null);
                  }
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shadow-xl ${viewMode === 'train' ? 'bg-purple-500 border-purple-400' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}
                title="Training Mode"
            >
                <i className="fas fa-brain text-white"></i>
            </button>
            <button 
                onClick={() => setIsAccessibilityMode(!isAccessibilityMode)}
                title="Toggle Accessibility Mode"
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shadow-xl ${isAccessibilityMode ? 'bg-yellow-400 border-black text-black scale-110' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
            >
                <i className="fas fa-universal-access text-xl"></i>
            </button>
            <button 
                onClick={() => setViewMode(viewMode === 'camera' ? 'map' : 'camera')}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/10 shadow-xl"
            >
                <i className={`fas ${viewMode === 'camera' ? 'fa-map-marked-alt' : 'fa-video'} text-lg text-cyan-400`}></i>
            </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {viewMode === 'train' ? (
          <div className="w-full h-full flex flex-col md:flex-row p-6 pt-28 gap-6 overflow-y-auto">
            <div className="flex-1 flex flex-col gap-6">
              <div className="bg-slate-900/50 border border-purple-500/30 p-8 rounded-[40px] backdrop-blur-xl">
                <h2 className="text-3xl font-black text-purple-400 mb-2 uppercase tracking-tighter flex items-center gap-4">
                  <i className="fas fa-graduation-cap"></i>
                  Learning Phase
                </h2>
                <p className="text-slate-400 text-sm mb-8">Teach the system a new campus area by capturing photos and providing metadata.</p>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Location Name</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-purple-500 outline-none transition-all"
                        placeholder="e.g. Dean's Office Entrance"
                        value={trainingMetadata.name}
                        onChange={(e) => setTrainingMetadata({...trainingMetadata, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Block / Department</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-purple-500 outline-none transition-all"
                        placeholder="e.g. Block C"
                        value={trainingMetadata.block}
                        onChange={(e) => setTrainingMetadata({...trainingMetadata, block: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Floor Level</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-purple-500 outline-none transition-all"
                        placeholder="e.g. 1st Floor"
                        value={trainingMetadata.floor}
                        onChange={(e) => setTrainingMetadata({...trainingMetadata, floor: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Location Type</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-purple-500 outline-none transition-all appearance-none"
                        value={trainingMetadata.type}
                        onChange={(e) => setTrainingMetadata({...trainingMetadata, type: e.target.value as any})}
                      >
                        <option value="entrance">Entrance</option>
                        <option value="cabin">Cabin</option>
                        <option value="lab">Lab</option>
                        <option value="office">Office</option>
                        <option value="corridor">Corridor</option>
                        <option value="library">Library</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-6 bg-purple-500/10 border border-dashed border-purple-500/30 rounded-3xl flex flex-col items-center gap-4">
                    <div className="flex gap-2 flex-wrap justify-center">
                      {trainingImages.length > 0 ? (
                        trainingImages.map((img, i) => (
                          <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-purple-500 shadow-lg">
                            <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setTrainingImages(trainingImages.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 bg-black/50 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 text-xs py-4 italic">No images captured yet</p>
                      )}
                    </div>
                    <button 
                      onClick={() => setViewMode('camera')}
                      className="text-purple-400 font-black text-[10px] uppercase tracking-widest hover:text-purple-300"
                    >
                      <i className="fas fa-plus-circle mr-2"></i> Use Camera to Capture
                    </button>
                  </div>

                  <button 
                    onClick={handleStartTraining}
                    disabled={isProcessing || trainingImages.length === 0}
                    className="w-full py-5 bg-purple-600 hover:bg-purple-500 text-white rounded-3xl font-black text-lg shadow-xl shadow-purple-900/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                       <div className="animate-spin h-6 w-6 border-4 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <i className="fas fa-microchip"></i>
                        INITIATE TRAINING
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1">
               {learnedProfile ? (
                 <div className="bg-slate-900/80 border border-emerald-500/30 p-10 rounded-[40px] shadow-2xl animate-in fade-in slide-in-from-right-10 duration-700">
                    <div className="flex justify-between items-start mb-8">
                       <div>
                         <h3 className="text-emerald-400 text-sm font-black uppercase tracking-widest mb-1">Location Profile Created</h3>
                         <h4 className="text-4xl font-black text-white">{learnedProfile.name}</h4>
                       </div>
                       <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-2xl font-black text-xs border border-emerald-500/20">
                          LEARNING COMPLETED
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-10">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Images</p>
                          <p className="text-xl font-black">{learnedProfile.imageCount}</p>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Type</p>
                          <p className="text-xl font-black capitalize">{learnedProfile.type}</p>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Accuracy</p>
                          <p className="text-xl font-black">High</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Learned Feature Extraction</h5>
                        <div className="p-6 bg-black/40 rounded-3xl border border-white/10 text-slate-300 text-sm leading-relaxed max-h-60 overflow-y-auto italic">
                           {learnedProfile.learnedFeatures}
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4">
                       <button 
                        onClick={() => {
                          setTrainingImages([]);
                          setLearnedProfile(null);
                        }}
                        className="flex-1 py-4 bg-white/10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/20 transition-all"
                       >
                         Train New
                       </button>
                       <button 
                        onClick={() => setViewMode('camera')}
                        className="flex-1 py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-400 shadow-xl shadow-emerald-900/20 transition-all"
                       >
                         Ready for Nav
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-12">
                    <i className="fas fa-layer-group text-8xl mb-6"></i>
                    <p className="font-black text-xl">Learning Engine Standby</p>
                    <p className="text-sm">Metadata and imagery required to initialize feature extraction.</p>
                 </div>
               )}
            </div>
          </div>
        ) : viewMode === 'camera' ? (
          <div className="w-full h-full">
            <CameraView 
              onCapture={handleVisionCapture} 
              isProcessing={isProcessing} 
              activeMode={cameraMode} 
              onModeChange={(mode) => {
                setCameraMode(mode);
                playTTS(mode === 'locate' ? "Positioning mode" : "Destination scanning mode");
              }}
            />
            
            {pendingLocation && !currentLocationId && (
              <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className={`border p-6 rounded-3xl max-w-xs text-center shadow-2xl ${isAccessibilityMode ? 'bg-black border-yellow-400 border-4' : 'bg-slate-900 border-cyan-500/50'}`}>
                  <h3 className={`${isAccessibilityMode ? 'text-3xl' : 'text-xl'} font-bold mb-4`}>Location Found?</h3>
                  <p className={`${isAccessibilityMode ? 'text-xl' : 'text-sm'} text-slate-400 mb-8`}>
                    {pendingLocation.description}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setPendingLocation(null)} className={`flex-1 py-4 rounded-xl font-bold ${isAccessibilityMode ? 'bg-white text-black text-xl' : 'bg-white/10 text-sm'}`}>No</button>
                    <button onClick={() => { setCurrentLocationId(pendingLocation.locationId); setPendingLocation(null); }} className={`flex-1 py-4 rounded-xl font-bold ${isAccessibilityMode ? 'bg-yellow-400 text-black text-xl' : 'bg-cyan-500 text-slate-950 text-sm'}`}>Confirm</button>
                  </div>
                </div>
              </div>
            )}

            {pendingDestination && (
              <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className={`border p-6 rounded-3xl max-w-xs text-center shadow-2xl ${isAccessibilityMode ? 'bg-black border-yellow-400 border-4' : 'bg-slate-900 border-rose-500/50'}`}>
                  <h3 className={`${isAccessibilityMode ? 'text-3xl' : 'text-xl'} font-bold mb-4`}>Go here?</h3>
                  <p className={`${isAccessibilityMode ? 'text-xl text-white' : 'text-sm text-slate-400'} mb-8`}>
                    {pendingDestination.description}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setPendingDestination(null)} className={`flex-1 py-4 rounded-xl font-bold ${isAccessibilityMode ? 'bg-white text-black text-xl' : 'bg-white/10 text-sm'}`}>Cancel</button>
                    <button onClick={() => { setDestinationId(pendingDestination.locationId); setPendingDestination(null); }} className={`flex-1 py-4 rounded-xl font-bold ${isAccessibilityMode ? 'bg-yellow-400 text-black text-xl' : 'bg-rose-500 text-white text-sm'}`}>Go!</button>
                  </div>
                </div>
              </div>
            )}

            {path.length > 0 && arrivalStatus !== 'confirmed' && (
                <div className="pointer-events-none">
                  <NavigationOverlay steps={navigationSteps} currentStepIndex={currentStepIndex} isAccessibilityMode={isAccessibilityMode} />
                  
                  <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-between items-end pointer-events-auto">
                    <button 
                      onClick={resetNav}
                      className={`w-20 h-20 border-4 rounded-3xl flex items-center justify-center backdrop-blur-md transition-all ${isAccessibilityMode ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-rose-500/20 border-rose-500/50 text-rose-500'}`}
                    >
                      <i className="fas fa-times text-2xl"></i>
                    </button>

                    <div className="flex-1 px-4">
                        {currentStepIndex === navigationSteps.length - 1 ? (
                          <div className={`p-6 rounded-2xl text-center shadow-xl animate-pulse ${isAccessibilityMode ? 'bg-yellow-400 border-4 border-black' : 'bg-emerald-500'}`}>
                             <p className={`${isAccessibilityMode ? 'text-black text-2xl font-black' : 'text-slate-950 font-black uppercase text-xs'}`}>VERIFY ARRIVAL</p>
                             <p className={`${isAccessibilityMode ? 'text-black text-lg font-bold' : 'text-slate-950 text-sm'}`}>Snap photo</p>
                          </div>
                        ) : (
                          <button 
                            onClick={nextStep}
                            className={`w-full py-6 rounded-3xl font-black shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-all ${isAccessibilityMode ? 'bg-yellow-400 text-black text-3xl border-4 border-black' : 'bg-cyan-500 text-slate-950'}`}
                          >
                            NEXT <i className="fas fa-chevron-right"></i>
                          </button>
                        )}
                    </div>
                  </div>
                </div>
            )}

            {arrivalStatus === 'confirmed' && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                 <div className={`text-center p-10 border rounded-[40px] shadow-2xl max-w-sm ${isAccessibilityMode ? 'bg-black border-yellow-400 border-8' : 'bg-slate-950 border-emerald-500/50'}`}>
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg ${isAccessibilityMode ? 'bg-yellow-400 text-black' : 'bg-emerald-500 text-slate-950'}`}>
                      <i className="fas fa-check text-5xl"></i>
                    </div>
                    <h2 className={`font-black mb-4 ${isAccessibilityMode ? 'text-5xl' : 'text-3xl'}`}>ARRIVED!</h2>
                    <p className={`mb-10 leading-relaxed ${isAccessibilityMode ? 'text-2xl font-bold' : 'text-slate-400'}`}>Target Reached: <b>{CAMPUS_NODES.find(n => n.id === destinationId)?.name}</b>.</p>
                    <button onClick={resetNav} className={`w-full py-6 rounded-2xl font-black tracking-widest ${isAccessibilityMode ? 'bg-yellow-400 text-black text-3xl' : 'bg-emerald-500 text-slate-950'}`}>DONE</button>
                 </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`w-full h-full p-6 pt-28 ${isAccessibilityMode ? 'bg-black' : 'bg-slate-950'}`}>
            <div className="h-1/2 mb-6">
                <CampusMap 
                    currentLocationId={currentLocationId} 
                    destinationId={destinationId} 
                    path={path}
                    onSelectNode={(id) => {
                        setDestinationId(id);
                        playTTS(`Destination set to ${CAMPUS_NODES.find(n => n.id === id)?.name}`);
                    }}
                />
            </div>
            <div className="space-y-4">
              <h3 className={`font-black tracking-[0.2em] uppercase flex justify-between ${isAccessibilityMode ? 'text-yellow-400 text-2xl' : 'text-slate-500 text-xs'}`}>
                Pick Destination
              </h3>
              <div className={`grid grid-cols-1 gap-2 overflow-y-auto max-h-[35vh] pr-2 scrollbar-hide`}>
                  {CAMPUS_NODES.map(node => (
                      <button
                          key={node.id}
                          onClick={() => {
                            setDestinationId(node.id);
                            playTTS(`Selected ${node.name}`);
                          }}
                          className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all ${destinationId === node.id ? (isAccessibilityMode ? 'bg-yellow-400 border-white text-black' : 'bg-cyan-500 border-cyan-400 text-slate-950') : (isAccessibilityMode ? 'bg-black border-yellow-400 text-white' : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/20')}`}
                      >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${destinationId === node.id ? 'bg-slate-950 text-cyan-400' : 'bg-white/5'}`}>
                            <i className={`fas ${node.type === 'outdoor' ? 'fa-building' : node.type === 'lab' ? 'fa-flask' : 'fa-door-open'} text-xl`}></i>
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className={`font-black ${isAccessibilityMode ? 'text-2xl' : 'text-sm'}`}>{node.name}</h4>
                            <p className={`${isAccessibilityMode ? 'text-lg text-white/70' : 'text-[10px] text-slate-500'}`}>{node.description}</p>
                          </div>
                      </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        <aside className={`absolute right-0 top-0 bottom-0 w-96 bg-black border-l z-[100] transition-transform duration-500 transform ${showChat ? 'translate-x-0' : 'translate-x-full'} ${isAccessibilityMode ? 'border-yellow-400 border-l-4' : 'border-white/5 shadow-2xl'}`}>
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className={`font-black flex items-center gap-2 ${isAccessibilityMode ? 'text-3xl text-yellow-400' : 'text-xl'}`}>AI ASSISTANT</h2>
                    <button onClick={() => setShowChat(false)} className={`w-12 h-12 rounded-full flex items-center justify-center ${isAccessibilityMode ? 'bg-yellow-400 text-black' : 'bg-white/5 text-slate-400'}`}>
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] p-5 rounded-3xl leading-relaxed ${m.role === 'user' ? (isAccessibilityMode ? 'bg-yellow-400 text-black font-black' : 'bg-cyan-500 text-slate-950') : (isAccessibilityMode ? 'bg-black border-2 border-yellow-400 text-white text-xl font-bold' : 'bg-white/5 text-slate-300')}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
      </main>

      <div className={`p-4 border-t flex justify-center gap-12 z-50 ${isAccessibilityMode ? 'bg-black border-yellow-400' : 'bg-slate-950 border-white/5'}`}>
          <div className="flex flex-col items-center">
            <span className={`${isAccessibilityMode ? 'text-sm text-yellow-400 font-black' : 'text-[9px] text-slate-600 font-black'} uppercase`}>Vision</span>
            <span className={`${isAccessibilityMode ? 'text-lg font-bold' : 'text-[10px] text-emerald-500'}`}>READY</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={`${isAccessibilityMode ? 'text-sm text-yellow-400 font-black' : 'text-[9px] text-slate-600 font-black'} uppercase`}>Phase</span>
            <span className={`${isAccessibilityMode ? 'text-lg font-bold' : 'text-[10px] text-cyan-400'}`}>{viewMode === 'train' ? 'LEARN' : 'NAV'}</span>
          </div>
      </div>
    </div>
  );
};

export default App;

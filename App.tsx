
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CAMPUS_NODES } from './constants';
import { NavigationStep, ChatMessage } from './types';
import { GeminiService } from './services/geminiService';
import { findShortestPath } from './services/pathfinding';
import CameraView from './components/CameraView';
import NavigationOverlay from './components/NavigationOverlay';
import CampusMap from './components/CampusMap';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'camera' | 'map'>('camera');
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const gemini = useMemo(() => new GeminiService(), []);

  // Update path whenever start or end changes
  useEffect(() => {
    if (currentLocationId && destinationId) {
      const newPath = findShortestPath(currentLocationId, destinationId);
      setPath(newPath);
      setCurrentStepIndex(0);
      
      // Get AI advice for the path
      gemini.getNavigationAdvice(
        CAMPUS_NODES.find(n => n.id === currentLocationId)?.name || 'current spot',
        CAMPUS_NODES.find(n => n.id === destinationId)?.name || 'destination',
        newPath.map(id => CAMPUS_NODES.find(n => n.id === id)?.name || id)
      ).then(advice => {
        setMessages(prev => [...prev, { role: 'model', text: advice }]);
      });
    } else {
      setPath([]);
    }
  }, [currentLocationId, destinationId, gemini]);

  const handleVisionCapture = useCallback(async (base64: string) => {
    setIsProcessing(true);
    const result = await gemini.detectLocation(base64);
    setIsProcessing(false);

    if (result && result.confidence > 0.6) {
      setCurrentLocationId(result.locationId);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `Identified your location: **${CAMPUS_NODES.find(n => n.id === result.locationId)?.name}**. ${result.description}` 
      }]);
    } else {
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: "I'm not sure where you are. Try to get a clearer view of a building sign or unique architecture." 
      }]);
    }
  }, [gemini]);

  const navigationSteps = useMemo(() => {
    if (path.length < 2) return [];
    const steps: NavigationStep[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const nextNode = CAMPUS_NODES.find(n => n.id === path[i + 1]);
      steps.push({
        instruction: `Head towards the ${nextNode?.name}`,
        direction: 'straight'
      });
    }
    steps.push({
      instruction: "You have arrived at your destination!",
      direction: 'arrive'
    });
    return steps;
  }, [path]);

  const toggleNavigation = () => {
    if (currentStepIndex < navigationSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setDestinationId(null);
      setPath([]);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100">
      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-slate-900/80 to-transparent flex justify-between items-center backdrop-blur-[2px]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <i className="fas fa-location-arrow text-cyan-400"></i>
            GEMINI <span className="text-cyan-400">CAMPUS</span>
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">AR Navigation Assistant</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setViewMode(viewMode === 'camera' ? 'map' : 'camera')}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10"
            >
                <i className={`fas ${viewMode === 'camera' ? 'fa-map' : 'fa-camera'} text-sm`}></i>
            </button>
            <button 
                onClick={() => setShowChat(!showChat)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10"
            >
                <i className="fas fa-comment-alt text-sm"></i>
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {viewMode === 'camera' ? (
          <div className="w-full h-full relative">
            <CameraView onCapture={handleVisionCapture} isProcessing={isProcessing} />
            {path.length > 0 && (
                <>
                  <NavigationOverlay steps={navigationSteps} currentStepIndex={currentStepIndex} />
                  <button 
                    onClick={toggleNavigation}
                    className="absolute bottom-32 right-6 bg-cyan-500 hover:bg-cyan-400 text-white font-bold p-4 rounded-full shadow-lg shadow-cyan-500/20 active:scale-95 transition-all pointer-events-auto"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </>
            )}
          </div>
        ) : (
          <div className="w-full h-full p-6 pt-24 bg-slate-900">
            <div className="h-2/3 mb-6">
                <CampusMap 
                    currentLocationId={currentLocationId} 
                    destinationId={destinationId} 
                    path={path}
                    onSelectNode={(id) => setDestinationId(id)}
                />
            </div>
            <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[30%] pr-2 scrollbar-hide">
                {CAMPUS_NODES.map(node => (
                    <button
                        key={node.id}
                        onClick={() => setDestinationId(node.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${destinationId === node.id ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                        <h4 className="text-sm font-bold truncate">{node.name}</h4>
                        <p className="text-[10px] opacity-60 line-clamp-1">{node.description}</p>
                    </button>
                ))}
            </div>
          </div>
        )}

        {/* AI Chat Sidebar */}
        <aside className={`absolute right-0 top-0 bottom-0 w-80 bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-[60] transition-transform duration-300 transform ${showChat ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2">
                        <i className="fas fa-robot text-cyan-400"></i>
                        AI Assistant
                    </h2>
                    <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <i className="fas fa-sparkles text-3xl mb-4 block"></i>
                            <p className="text-sm">Scan your surroundings or pick a destination to start.</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-cyan-500 text-white' : 'bg-white/10 text-slate-200'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-white/10">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Ask me anything..." 
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 px-4 text-sm focus:outline-none focus:border-cyan-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const text = (e.target as HTMLInputElement).value;
                                    setMessages(prev => [...prev, { role: 'user', text }]);
                                    (e.target as HTMLInputElement).value = '';
                                    // Simulation of AI response
                                    setTimeout(() => {
                                        setMessages(prev => [...prev, { role: 'model', text: "I'm looking that up for you. Try scanning your environment if you are lost!" }]);
                                    }, 1000);
                                }
                            }}
                        />
                        <i className="fas fa-paper-plane absolute right-4 top-2.5 text-slate-500"></i>
                    </div>
                </div>
            </div>
        </aside>
      </main>

      {/* Quick Status Bar */}
      <footer className="bg-slate-900 border-t border-white/10 p-4 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${currentLocationId ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <div className="text-xs">
                <p className="text-slate-400 font-medium">Status</p>
                <p className="font-bold">{currentLocationId ? `At ${CAMPUS_NODES.find(n => n.id === currentLocationId)?.name}` : 'Locating...'}</p>
            </div>
        </div>
        {destinationId && (
            <div className="text-right">
                <p className="text-slate-400 text-xs font-medium">Destination</p>
                <p className="text-xs font-bold text-cyan-400">{CAMPUS_NODES.find(n => n.id === destinationId)?.name}</p>
            </div>
        )}
      </footer>
    </div>
  );
};

export default App;

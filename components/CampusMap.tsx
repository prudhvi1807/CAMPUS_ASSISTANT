
import React from 'react';
import { CAMPUS_NODES, CAMPUS_EDGES } from '../constants';

interface CampusMapProps {
  currentLocationId: string | null;
  destinationId: string | null;
  path: string[];
  onSelectNode: (id: string) => void;
}

const CampusMap: React.FC<CampusMapProps> = ({ currentLocationId, destinationId, path, onSelectNode }) => {
  return (
    <div className="w-full h-full bg-slate-900 relative rounded-2xl border border-white/10 overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Draw Edges */}
        {CAMPUS_EDGES.map((edge, i) => {
          const from = CAMPUS_NODES.find(n => n.id === edge.from)!;
          const to = CAMPUS_NODES.find(n => n.id === edge.to)!;
          const isPath = path.includes(edge.from) && path.includes(edge.to) && 
                         Math.abs(path.indexOf(edge.from) - path.indexOf(edge.to)) === 1;
          
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isPath ? '#22d3ee' : '#334155'}
              strokeWidth={isPath ? 1.5 : 0.5}
              strokeDasharray={isPath ? '0' : '2 2'}
            />
          );
        })}

        {/* Draw Nodes */}
        {CAMPUS_NODES.map(node => (
          <g 
            key={node.id} 
            className="cursor-pointer group" 
            onClick={() => onSelectNode(node.id)}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={currentLocationId === node.id || destinationId === node.id ? 2.5 : 1.5}
              fill={
                currentLocationId === node.id ? '#10b981' : 
                destinationId === node.id ? '#f43f5e' : 
                path.includes(node.id) ? '#22d3ee' : '#64748b'
              }
              className="transition-all duration-300 group-hover:r-3"
            />
            <text
              x={node.x}
              y={node.y - 4}
              textAnchor="middle"
              className="text-[3px] fill-slate-400 font-medium pointer-events-none group-hover:fill-white"
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> You are here
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-rose-500" /> Destination
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-cyan-400" /> Planned Path
        </div>
      </div>
    </div>
  );
};

export default CampusMap;

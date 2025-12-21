
import { CampusNode, CampusEdge } from './types';

export const CAMPUS_NODES: CampusNode[] = [
  { id: 'gate', name: 'Main Gate', description: 'The primary entrance to the campus.', x: 10, y: 50 },
  { id: 'admin', name: 'Admin Block', description: 'Administrative offices and student services.', x: 30, y: 30 },
  { id: 'library', name: 'Central Library', description: 'The hub of academic resources.', x: 50, y: 20 },
  { id: 'canteen', name: 'Main Canteen', description: 'Food court and relaxation zone.', x: 40, y: 70 },
  { id: 'blockA', name: 'Academic Block A', description: 'Engineering and Science classrooms.', x: 70, y: 40 },
  { id: 'blockB', name: 'Academic Block B', description: 'Humanities and Business classrooms.', x: 80, y: 60 },
  { id: 'auditorium', name: 'Main Auditorium', description: 'Large venue for events.', x: 60, y: 80 },
];

export const CAMPUS_EDGES: CampusEdge[] = [
  { from: 'gate', to: 'admin', distance: 200 },
  { from: 'admin', to: 'library', distance: 150 },
  { from: 'admin', to: 'canteen', distance: 180 },
  { from: 'library', to: 'blockA', distance: 120 },
  { from: 'canteen', to: 'auditorium', distance: 100 },
  { from: 'blockA', to: 'blockB', distance: 150 },
  { from: 'blockB', to: 'auditorium', distance: 130 },
  { from: 'blockA', to: 'auditorium', distance: 250 },
];

export const SYSTEM_PROMPT = `
You are a Campus Navigation Assistant. 
You are given a map of nodes: Main Gate, Admin Block, Central Library, Main Canteen, Academic Block A, Academic Block B, and Main Auditorium.
Your job is to identify a location from a visual description or image and provide navigation instructions.
If identifying from an image, analyze landmarks like signage, building colors, and surroundings.
When providing directions, use a helpful, student-friendly tone.
Always refer to the nodes by their official names.
`;

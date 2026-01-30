
import { CampusNode, CampusEdge } from './types';

export const CAMPUS_NODES: CampusNode[] = [
  { id: 'gate', name: 'Main Gate', type: 'outdoor', description: 'Primary entrance', x: 5, y: 50 },
  { id: 'admin_lobby', name: 'Admin Lobby', type: 'indoor', description: 'Administrative main hall', x: 25, y: 35 },
  { id: 'dean_office', name: 'Dean Office (C-102)', type: 'cabin', description: 'Faculty area, first floor', x: 30, y: 25 },
  { id: 'library_main', name: 'Central Library', type: 'indoor', description: 'Main academic hub', x: 50, y: 20 },
  { id: 'canteen_hub', name: 'Student Canteen', type: 'indoor', description: 'Food and dining area', x: 45, y: 75 },
  { id: 'blockA_entrance', name: 'Academic Block A', type: 'outdoor', description: 'Engineering building entrance', x: 70, y: 45 },
  { id: 'robotics_lab', name: 'Robotics Lab (L-201)', type: 'lab', description: 'Block A, 2nd Floor', x: 75, y: 35 },
  { id: 'blockB_entrance', name: 'Academic Block B', type: 'outdoor', description: 'Humanities entrance', x: 85, y: 65 },
  { id: 'it_helpdesk', name: 'IT Helpdesk', type: 'cabin', description: 'Block B, Ground Floor', x: 80, y: 75 },
  { id: 'auditorium', name: 'Main Auditorium', type: 'outdoor', description: 'Event venue', x: 65, y: 85 },
];

export const CAMPUS_EDGES: CampusEdge[] = [
  { from: 'gate', to: 'admin_lobby', distance: 150 },
  { from: 'admin_lobby', to: 'dean_office', distance: 50, instruction: 'Take the stairs to the first floor' },
  { from: 'admin_lobby', to: 'library_main', distance: 120 },
  { from: 'admin_lobby', to: 'canteen_hub', distance: 180 },
  { from: 'library_main', to: 'blockA_entrance', distance: 200 },
  { from: 'blockA_entrance', to: 'robotics_lab', distance: 80, instruction: 'Head to the second floor elevator' },
  { from: 'blockA_entrance', to: 'blockB_entrance', distance: 150 },
  { from: 'blockB_entrance', to: 'it_helpdesk', distance: 40, instruction: 'Enter the lobby and turn left' },
  { from: 'blockB_entrance', to: 'auditorium', distance: 130 },
  { from: 'canteen_hub', to: 'auditorium', distance: 110 },
];

export const SYSTEM_PROMPT = `
You are an advanced Campus Navigation AI.
You identify locations from images (including indoor hallways, specific cabins like C-102, or labs like L-201).
Nodes: ${CAMPUS_NODES.map(n => n.name).join(', ')}.

Rules:
1. Identify the location and provide a confidence score (0-1).
2. If confidence is below 0.7, explain why you are unsure.
3. Provide descriptive landmarks for navigation.
4. When confirming arrival, verify the specific features of the destination.
`;

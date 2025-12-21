
export interface CampusNode {
  id: string;
  name: string;
  description: string;
  x: number; // Percent of map width
  y: number; // Percent of map height
}

export interface CampusEdge {
  from: string;
  to: string;
  distance: number;
}

export interface NavigationStep {
  instruction: string;
  direction: 'left' | 'right' | 'straight' | 'arrive';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface DetectionResult {
  locationId: string;
  confidence: number;
  description: string;
}

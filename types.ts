
export interface CampusNode {
  id: string;
  name: string;
  description: string;
  type: 'outdoor' | 'indoor' | 'cabin' | 'lab' | 'office' | 'entrance';
  x: number; // Percent of map width
  y: number; // Percent of map height
}

export interface LocationMetadata {
  name: string;
  block: string;
  floor: string;
  type: 'entrance' | 'cabin' | 'lab' | 'office' | 'corridor' | 'library';
}

export interface LocationProfile extends LocationMetadata {
  id: string;
  learnedFeatures: string;
  imageCount: number;
}

export interface CampusEdge {
  from: string;
  to: string;
  distance: number;
  instruction?: string;
}

export interface NavigationStep {
  instruction: string;
  direction: 'left' | 'right' | 'straight' | 'arrive';
  landmark?: string;
  distance?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface DetectionResult {
  locationId: string;
  confidence: number;
  description: string;
  isConfirmed?: boolean;
}

export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'updating';
  lastSeen: string;
  currentVersion: string;
  targetVersion: string;
  type: string;
  health: 'good' | 'warning' | 'critical';
  progress?: number;
  expression?: 'happy' | 'sad' | 'angry' | 'focused' | 'confused';
}

export interface UpdatePackage {
  version: string;
  releaseDate: string;
  status: 'draft' | 'testing' | 'released';
  description: string;
  targetDevices: string[];
}
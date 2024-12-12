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
  script_content?: string;
  auto_update: boolean;
  user_id: string;
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
  created_at: string;
  updated_at: string;
  unit: string;
  value: number;
  title: string;
}

export interface UpdatePackage {
  version: string;
  releaseDate: string;
  status: 'draft' | 'testing' | 'released';
  description: string;
  targetDevices: string[];
}
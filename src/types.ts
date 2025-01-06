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
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
  github_status?: 'up-to-date' | 'updating' | 'error';
  github_error?: string;
  last_github_check?: string;
  title: string;
  value: number;
  unit: string;
  auto_update: boolean;
  user_id: string;
  connected: boolean;
  last_connected: string;
  created_at: string;
  updated_at: string;
  isExpanded?: boolean;
  tag: string;
}

export interface UpdatePackage {
  version: string;
  releaseDate: string;
  status: 'draft' | 'testing' | 'released';
  description: string;
  targetDevices: string[];
}
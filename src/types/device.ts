export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UPDATING' | 'ERROR' | 'MAINTENANCE';

export interface Device {
  id: string;
  title: string;
  device_tag: string;
  status: DeviceStatus;
  auto_update: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  device_token: string | null;
  script_content: string | null;
  github_status: string | null;
  last_commit_sha: string | null;
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  repo_type?: 'github' | 'gitlab';
  github_token?: string;
  github_username?: string;
  isExpanded?: boolean; // UI-only field
  timestamp_download?: string;
}

export interface CreateDeviceInput {
  title: string;
  device_tag: string;
  auto_update: boolean;
  repo_type?: 'github' | 'gitlab';
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
}

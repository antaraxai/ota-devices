export type DeviceStatus = 'Normal' | 'Warning' | 'High' | 'Error' | 'awaiting_connection';

export interface Device {
  id: string;
  title: string;
  tag: string;
  status: DeviceStatus;
  auto_update: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  device_token: string | null;
  script_content: string | null;
  github_status: string | null;
  last_commit_sha: string | null;
  repo_url: string | null;
  repo_branch: string | null;
  repo_path: string | null;
  github_token: string | null;
  github_username: string | null;
  isExpanded?: boolean; // UI-only field
}

export interface CreateDeviceInput {
  title: string;
  tag: string;
  auto_update: boolean;
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
}

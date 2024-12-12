export type DeviceType = 'Thermostat' | 'Light' | 'Lock' | 'Camera';

export type DeviceStatus = 'Normal' | 'Warning' | 'High' | 'Error';

export interface Device {
  id: string;
  title: string;
  type: DeviceType;
  value: number;
  unit: '°C' | '%';
  status: DeviceStatus;
  auto_update: boolean;
  user_id: string;
  // GitHub integration fields
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
  script_content?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDeviceInput {
  title: string;
  type: DeviceType;
  value: number;
  unit: '°C' | '%';
  auto_update: boolean;
  // GitHub integration fields
  repo_url?: string;
  repo_branch?: string;
  repo_path?: string;
  github_token?: string;
  github_username?: string;
}

import { Device } from '../types/device';

interface GitHubFileResponse {
  content: string;
  encoding: string;
}

export class GitHubService {
  private static async fetchWithAuth(url: string, token: string) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async downloadFile(device: Device): Promise<string> {
    if (!device.github_token || !device.repo_url || !device.repo_path) {
      throw new Error('Missing GitHub configuration');
    }

    try {
      // Parse repository information from repo_url
      const repoUrlMatch = device.repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!repoUrlMatch) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repo] = repoUrlMatch;
      const branch = device.repo_branch || 'main';
      const path = device.repo_path.startsWith('/') ? device.repo_path.slice(1) : device.repo_path;

      // Construct the GitHub API URL
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

      // Fetch file content
      const response = await this.fetchWithAuth(apiUrl, device.github_token);
      const fileData = response as GitHubFileResponse;

      // Decode base64 content
      const decodedContent = atob(fileData.content);
      return decodedContent;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to download file from GitHub: ${error.message}`);
      }
      throw new Error('Failed to download file from GitHub');
    }
  }

  static async validateGitHubConfig(device: Partial<Device>): Promise<boolean> {
    if (!device.github_token || !device.repo_url || !device.repo_path) {
      return false;
    }

    try {
      const repoUrlMatch = device.repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!repoUrlMatch) {
        return false;
      }

      const [, owner, repo] = repoUrlMatch;
      const branch = device.repo_branch || 'main';
      const path = device.repo_path.startsWith('/') ? device.repo_path.slice(1) : device.repo_path;

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      await this.fetchWithAuth(apiUrl, device.github_token);

      return true;
    } catch (error) {
      return false;
    }
  }
}

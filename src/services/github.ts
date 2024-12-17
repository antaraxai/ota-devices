import { Device } from '../types/device';

interface GitHubFileResponse {
  content: string;
  encoding: string;
}

export class GitHubService {
  private static async fetchWithAuth(url: string, token: string) {
    // Clean the token (remove any whitespace)
    const cleanToken = token.trim();
    
    console.log('Making GitHub API request to:', url);
    console.log('Using token starting with:', cleanToken.substring(0, 8));

    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'antara-app'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  static async downloadFile(device: Device): Promise<string> {
    if (!device.github_token?.trim()) {
      throw new Error('GitHub token is missing or empty');
    }

    console.log('Downloading file with device config:', {
      hasToken: true,
      tokenLength: device.github_token.length,
      tokenStart: device.github_token.substring(0, 8),
      repoUrl: device.repo_url,
      repoPath: device.repo_path,
      branch: device.repo_branch
    });

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
      console.log('Fetching from GitHub URL:', apiUrl);

      // Fetch file content
      const response = await this.fetchWithAuth(apiUrl, device.github_token);
      console.log('GitHub API response type:', response ? typeof response : 'null');

      const fileData = response as GitHubFileResponse;
      if (!fileData.content) {
        throw new Error('No content received from GitHub');
      }

      // Decode base64 content
      const decodedContent = atob(fileData.content);
      return decodedContent;
    } catch (error) {
      console.error('GitHub download error:', error);
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

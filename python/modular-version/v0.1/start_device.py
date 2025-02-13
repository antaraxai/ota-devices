#!/usr/bin/env python3
"""Main entry point for device script."""

import os
import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from gitlab_controller import GitLabController

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
print(f'Looking for .env file at: {env_path}')
load_dotenv(env_path)

def main():
    """Main entry point with command line argument parsing."""
    try:
        parser = argparse.ArgumentParser(description='Device Script')
        parser.add_argument('device_id', help='Device ID')
        args = parser.parse_args()

        # Get GitLab credentials from environment
        gitlab_token = os.getenv('GITLAB_PERSONAL_ACCESS_TOKEN')
        if not gitlab_token:
            print("Error: GITLAB_PERSONAL_ACCESS_TOKEN environment variable is required", file=sys.stderr)
            sys.exit(1)

        # Create config and workspace directory
        work_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workspace')
        os.makedirs(work_dir, exist_ok=True)
        
        config = {
            'device_token': '49143486-5b8d-4a14-8b71-9be32180e5da',
            'work_dir': work_dir
        }

        # Create and run controller
        try:
            controller = GitLabController(
                supabase_url=None,
                supabase_key=None,
                device_id=args.device_id,
                device_token=config['device_token'],
                work_dir=config['work_dir']
            )
            
            # Print process info for parent process
            print(json.dumps({
                'status': 'initialized',
                'pid': os.getpid()
            }))
            sys.stdout.flush()

            controller.run()

        except Exception as e:
            print(json.dumps({
                'error': str(e),
                'status': 'failed'
            }), file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Error running device script: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

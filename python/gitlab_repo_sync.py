import gitlab
import git
import os
import time
import logging
import sys

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# GitLab configuration
GITLAB_URL = 'https://gitlab.com'
GITLAB_TOKEN = 'glpat-Z-nACne6_uCb5We8Bgg2'
PROJECT_ID = '40026523'
BRANCH_NAME = 'fix/working-branch'  # or whichever branch you want to monitor

# Local repository configuration
# LOCAL_REPO_PATH = '/Users/rekaali/Documents/GitHub/pi4'
LOCAL_REPO_PATH = '/home/pi/raspi-dev'

def check_and_update_repo():
    try:
        # Connect to GitLab
        gl = gitlab.Gitlab(GITLAB_URL, private_token=GITLAB_TOKEN)
        project = gl.projects.get(PROJECT_ID)

        # Get the latest commit on the specified branch
        latest_commit = project.commits.list(ref_name=BRANCH_NAME, per_page=1, get_all=False)[0]

        # Open the local repository
        repo = git.Repo(LOCAL_REPO_PATH)

        # Get the current local commit
        current_commit = repo.head.commit

        # Compare the commit SHAs
        if current_commit.hexsha != latest_commit.id:
            logging.info("Changes detected. Pulling updates...")
            
            # Fetch and pull changes
            origin = repo.remotes.origin
            origin.fetch()
            origin.pull()

            logging.info("Repository updated successfully.")
            return True
        else:
            logging.info("No changes detected.")
            return False

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return False

def main():
    if check_and_update_repo():
        logging.info("Updates were applied. Exiting.")
    else:
        logging.info("No updates were necessary. Exiting.")
    sys.exit(0)

if __name__ == "__main__":
    main()

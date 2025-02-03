# File Manager
import os
from current_logger import Logger

class FileManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.logger.log("File Manager initialized")

    def backup_file(self, file_path):
        if not os.path.exists(file_path):
            self.logger.log(f"Warning: File {file_path} does not exist, skipping backup")
            return False
        
        backup_path = file_path + ".bak"
        self.logger.log(f"Backing up file: {file_path} to {backup_path}")
        try:
            import shutil
            shutil.copy2(file_path, backup_path)
            return True
        except Exception as e:
            self.logger.log(f"Error backing up file {file_path}: {e}")
            return False

    def restore_backup(self, file_path):
        backup_path = file_path + ".bak"
        if not os.path.exists(backup_path):
            self.logger.log(f"Warning: Backup file {backup_path} does not exist")
            return False

        try:
            import shutil
            shutil.copy2(backup_path, file_path)
            os.remove(backup_path)
            self.logger.log(f"Successfully restored {file_path} from backup")
            return True
        except Exception as e:
            self.logger.log(f"Error restoring backup for {file_path}: {e}")
            return False

    def download_update(self, file_path, update_url):
        try:
            import requests
            response = requests.get(update_url, stream=True)
            if response.status_code == 200:
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                self.logger.log(f"Successfully downloaded update for {file_path}")
                return True
            else:
                self.logger.log(f"Failed to download update. Status code: {response.status_code}")
                return False
        except Exception as e:
            self.logger.log(f"Error downloading update for {file_path}: {e}")
            return False

# File Manager
import os
from current_logger import Logger

class FileManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.logger.log("File Manager initialized")

    def backup_file(self, file_path):
        backup_path = file_path + ".bak"
        self.logger.log(f"Backing up file: {file_path} to {backup_path}")
        os.rename(file_path, backup_path)

# Controller - Main logic for execution loop
from current_connection_manager import ConnectionManager
from current_ota_manager import OTAManager
from current_file_manager import FileManager
from current_logger import Logger
import time

class Controller:
    def __init__(self):
        self.logger = Logger()
        self.connection_manager = ConnectionManager(self.logger)
        self.ota_manager = OTAManager(self.logger)
        self.file_manager = FileManager(self.logger)

    def run(self):
        self.logger.log("Starting main execution loop...")
        while True:
            try:
                # Check server connection
                if not self.connection_manager.connect():
                    self.logger.log("Failed to connect to server, retrying in 30 seconds...")
                    time.sleep(30)
                    continue

                # Check for updates
                updates = self.ota_manager.check_for_updates()
                for file, has_update in updates.items():
                    if has_update:
                        self.logger.log(f"Processing update for {file}")
                        # Backup current file
                        if not self.file_manager.backup_file(file):
                            self.logger.log(f"Failed to backup {file}, skipping update")
                            continue

                        # Download and apply update
                        update_url = f"{self.ota_manager.server_url}/download/{file}"
                        if not self.file_manager.download_update(file, update_url):
                            self.logger.log(f"Failed to download update for {file}")
                            # Restore backup if download fails
                            self.file_manager.restore_backup(file)

                # Wait before next check
                time.sleep(30)
            except Exception as e:
                self.logger.log(f"Error in controller: {e}")
                time.sleep(30)  # Wait before retrying after an error

if __name__ == "__main__":
    controller = Controller()
    try:
        controller.run()
    except KeyboardInterrupt:
        print("\nShutting down...")

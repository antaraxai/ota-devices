# Controller - Main logic for execution loop
from current_connection_manager import ConnectionManager
from current_ota_manager import OTAManager
from current_file_manager import FileManager
from current_logger import Logger

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
                self.connection_manager.connect()
                updates = self.ota_manager.check_for_updates()
                for file, has_update in updates.items():
                    if has_update:
                        self.file_manager.backup_file(file)
            except Exception as e:
                self.logger.log(f"Error in controller: {e}")

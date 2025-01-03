# Connection Manager
from current_logger import Logger

class ConnectionManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.logger.log("Connection Manager initialized")

    def connect(self):
        self.logger.log("Connecting to server...")
        return True
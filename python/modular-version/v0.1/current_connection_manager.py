# Connection Manager
from current_logger import Logger
import requests
import time

class ConnectionManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.server_url = "http://localhost:8000"  # Default server URL
        self.max_retries = 3
        self.retry_delay = 5
        self.logger.log("Connection Manager initialized")

    def connect(self):
        for attempt in range(self.max_retries):
            try:
                response = requests.get(f"{self.server_url}/health")
                if response.status_code == 200:
                    self.logger.log("Successfully connected to server")
                    return True
                self.logger.log(f"Server returned status code: {response.status_code}")
            except requests.exceptions.RequestException as e:
                self.logger.log(f"Connection attempt {attempt + 1} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)

        self.logger.log("Failed to connect to server after all retries")
        return False
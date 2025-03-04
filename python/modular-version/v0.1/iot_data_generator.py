import os
import random
import time
from datetime import datetime
import logging
from typing import Dict, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Set the path to the.env file
# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
print(f'Looking for .env file at: {env_path}')
load_dotenv(env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class IoTDataGenerator:
    def __init__(self):
        self.data_types = ['temperature', 'humidity', 'pressure', 'light', 'status']
        self.supabase: Client = None

    def connect_to_db(self) -> None:
        """Establish Supabase connection"""
        try:
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            if not supabase_url or not supabase_key:
                raise ValueError("Supabase credentials not found in environment variables")
            
            self.supabase = create_client(supabase_url, supabase_key)
            logging.info("Successfully connected to Supabase")
        except Exception as e:
            logging.error(f"Error connecting to Supabase: {e}")
            raise

    def get_active_device_ids(self) -> List[int]:
        """Get device IDs from Supabase"""
        try:
            response = self.supabase.table('devices').select('id').execute()
            return [row['id'] for row in response.data]
        except Exception as e:
            logging.error(f"Error fetching device ID: {e}")
            return []

    def generate_sensor_value(self, data_type: str) -> str:
        """Generate random sensor values based on data type"""
        if data_type == 'temperature':
            return str(round(random.uniform(18.0, 30.0), 2))  # °C
        elif data_type == 'humidity':
            return str(round(random.uniform(30.0, 70.0), 2))  # %
        elif data_type == 'pressure':
            return str(round(random.uniform(980.0, 1020.0), 2))  # hPa
        elif data_type == 'light':
            return str(round(random.uniform(0, 1000), 2))  # lux
        elif data_type == 'status':
            # Generate status with weighted probability (80% online, 20% offline)
            return str(random.choices([1, 0], weights=[0.8, 0.2])[0])  # 1 for online, 0 for offline
        return "0"

    def insert_device_data(self, device_id: int, data_type: str, value: str) -> None:
        """Insert new device data into Supabase"""
        try:
            data = {
                'device_id': device_id,
                'timestamp': datetime.now().isoformat(),
                'data_type': data_type,
                'value': value,
            }
            self.supabase.table('device_data').insert(data).execute()
            logging.info(f"Inserted data for device {device_id}: {data_type} = {value}")
        except Exception as e:
            logging.error(f"Error inserting data: {e}")

    def run(self, interval: int = 60) -> None:
        """Run the data generation process"""
        try:
            self.connect_to_db()
            while True:
                device_ids = self.get_active_device_ids()
                if not device_ids:
                    logging.warning("No active devices found")
                    time.sleep(interval)
                    continue

                for device_id in device_ids:
                    for data_type in self.data_types:
                        value = self.generate_sensor_value(data_type)
                        self.insert_device_data(device_id, data_type, value)

                logging.info(f"Sleeping for {interval} seconds...")
                time.sleep(interval)

        except KeyboardInterrupt:
            logging.info("Stopping data generation...")

if __name__ == "__main__":
    # Create and run the data generator
    generator = IoTDataGenerator()
    generator.run(interval=30)  # Generate data every 60 seconds
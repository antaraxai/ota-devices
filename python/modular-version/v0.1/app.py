from flask import Flask, request, jsonify
from supabase import create_client
from gitlab_controller import GitLabController
import threading
import os

app = Flask(__name__)

# Supabase configuration
SUPABASE_URL = "https://hdodriygzudamnqqbluy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkb2RyaXlnenVkYW1ucXFibHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzcxMTA2OCwiZXhwIjoyMDM5Mjg3MDY4fQ.yNnuOxXhJDSVrcG2X59lEVFdwiKgAOC1kHHL5EMrxsk"

# Global dictionary to store running controllers
controllers = {}

def run_controller(device_id: str, device_token: str):
    """Run the GitLab controller in a separate thread."""
    try:
        controller = GitLabController(SUPABASE_URL, SUPABASE_KEY, device_id, device_token)
        controllers[device_id] = controller
        controller.run()
    except Exception as e:
        print(f"Error running controller for device {device_id}: {e}")
        if device_id in controllers:
            del controllers[device_id]

@app.route('/start', methods=['POST'])
def start_controller():
    """Start a new GitLab controller instance."""
    try:
        data = request.get_json()
        device_id = data.get('device_id')
        device_token = data.get('device_token')

        if not device_id or not device_token:
            return jsonify({'error': 'Missing device_id or device_token'}), 400

        # Check if controller is already running
        if device_id in controllers:
            return jsonify({'message': 'Controller already running for this device'}), 409

        # Start controller in a new thread
        thread = threading.Thread(target=run_controller, args=(device_id, device_token))
        thread.daemon = True
        thread.start()

        return jsonify({'message': 'Controller started successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stop/<device_id>', methods=['POST'])
def stop_controller(device_id):
    """Stop a running GitLab controller instance."""
    try:
        if device_id not in controllers:
            return jsonify({'error': 'No controller running for this device'}), 404

        # Get the controller and trigger graceful shutdown
        controller = controllers[device_id]
        controller.stop()  # Use the new stop method
        del controllers[device_id]

        return jsonify({'message': 'Controller stopped successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/status/<device_id>', methods=['GET'])
def controller_status(device_id):
    """Get the status of a controller."""
    try:
        if device_id not in controllers:
            return jsonify({'status': 'NOT_RUNNING'}), 200

        # Get the controller and return its status
        controller = controllers[device_id]
        status = controller.connection_manager.get_device_status()
        return jsonify({'status': status}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/list', methods=['GET'])
def list_controllers():
    """List all running controllers."""
    try:
        running_controllers = list(controllers.keys())
        return jsonify({'controllers': running_controllers}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

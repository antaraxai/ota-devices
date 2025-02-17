import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv('VITE_SUPABASE_URL')
supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
if not supabase_url or not supabase_key:
    raise ValueError("Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_KEY in .env file")

supabase = create_client(supabase_url, supabase_key)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3001", "http://localhost:5173"],
        "supports_credentials": True,
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "OPTIONS"]
    }
})

# Validate OpenAI API key
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY in .env file")

# Initialize OpenAI client
client = OpenAI(
    api_key=api_key
)

# Simple message storage (in-memory for testing)
message_history = []

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        user_message = data.get('message')
        history = data.get('history', [])
        device_id = data.get('device_id')
        
        print(f"Received request data: {data}")
        print(f"Device ID: {device_id}")
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400

        # If device_id is provided, fetch device status from Supabase
        device_status = None
        if device_id:
            try:
                response = supabase.table('devices').select('*').eq('id', device_id).execute()
                if response.data:
                    device_status = response.data[0]
            except Exception as e:
                print(f"Error fetching device status: {e}")

        # Add device status context to the system message if available
        system_message = (
            "You are an AI assistant specialized in device management and monitoring. "
            "Your responses should focus exclusively on device-related information, status updates, and system monitoring. "
            "You can help with:\n"
            "- Device status queries and monitoring\n"
            "- GitHub repository synchronization status\n"
            "- Device connection and health checks\n"
            "- System performance and updates\n"
            "Please do not provide responses outside of these device management topics."
        )
        
        if device_status:
            system_message += f"\nCurrent device status:\n"
            system_message += f"- Last commit timestamp: {device_status.get('last_commit_timestamp', 'N/A')}\n"
            system_message += f"- Status: {device_status.get('status', 'N/A')}\n"
            system_message += f"- GitHub status: {device_status.get('github_status', 'N/A')}\n"
            system_message += f"- Device ID: {device_id}\n"
            
        try:
            # Generate AI response using OpenAI
            chat_completion = client.chat.completions.create(
                model="gpt-4o-mini",  # Using GPT-3.5-turbo for better compatibility
                messages=[
                    {"role": "system", "content": system_message},
                    *history,
                    {"role": "user", "content": user_message}
                ]
            )
            
            # Get the AI response
            response = chat_completion.choices[0].message.content
            
            return jsonify({
                'message': response,
                'history': [
                    *history,
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": response}
                ]
            })
            
        except Exception as e:
            print(f"OpenAI API error: {str(e)}")
            return jsonify({'error': 'Failed to process chat request'}), 500
            
    except Exception as e:
        print(f"Server error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
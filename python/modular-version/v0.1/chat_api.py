"""Chat API with OpenAI integration."""

from flask import Blueprint, jsonify, request
import openai
import os
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Create blueprint
chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests."""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400

        # Get chat history from request (optional)
        messages = data.get('history', [])
        messages.append({
            'role': 'user',
            'content': data['message']
        })

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-4",  # or gpt-3.5-turbo
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )

        # Extract assistant's response
        assistant_message = response.choices[0].message['content']
        
        return jsonify({
            'message': assistant_message,
            'history': messages + [{'role': 'assistant', 'content': assistant_message}]
        })

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

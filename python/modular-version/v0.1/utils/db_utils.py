"""Database utilities."""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from .logging_utils import StructuredLogger

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise EnvironmentError("Missing required Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_key)
StructuredLogger.info('Initialized Supabase client')

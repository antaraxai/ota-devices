# Use Python 3.9 slim image as base
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create Git credentials directory
RUN mkdir -p /root/.git

# Copy requirements first to leverage Docker cache
COPY python/modular-version/v0.1/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python application
COPY python/modular-version/v0.1/ .

# Create necessary directories
RUN mkdir -p /app/src/templates /app/workspaces /app/logs

# Copy frontend templates
COPY src/templates /app/src/templates/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=device_api.py
ENV FLASK_ENV=production

# Configure Git to store credentials
RUN git config --global credential.helper store

# Expose the Flask port
EXPOSE 5001

# Start both the API and the GitLab controller
CMD ["sh", "-c", "python device_api.py & python run_gitlab_controller.py"]

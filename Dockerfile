# Use Python 3.9 slim image as base
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY python/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python application
COPY python/ .

# Create the directory structure for templates
RUN mkdir -p /app/src/templates

COPY src /app/src

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Command to run the application
CMD ["python", "gitlab_file_monitor.py"]

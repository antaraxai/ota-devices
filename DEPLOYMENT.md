# Antara Deployment Guide

This guide explains how to deploy the Antara web application using Docker and GitLab Container Registry.

## Prerequisites

- Docker and Docker Compose installed
- GitLab account with access to the Antara repository
- GitLab Container Registry access

## Environment Variables

The application requires several environment variables to function properly. Create a `.env` file with the following variables:

```
# Supabase configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# GitLab configuration
GITLAB_USERNAME=your_gitlab_username_here
GITLAB_TOKEN=your_gitlab_token_here

# Resend API (if needed)
RESEND_API_KEY=your_resend_api_key_here

# Stripe URLs (if needed)
VITE_STRIPE_PRO_URL=your_stripe_pro_url_here
VITE_STRIPE_FREE_URL=your_stripe_free_url_here
```

## Deployment Script

We provide a deployment script (`deploy.sh`) that simplifies the deployment process. The script supports several operations:

### Building and Pushing Docker Images

To build and push the Docker images to GitLab Container Registry:

```bash
./deploy.sh build
```

This will:
1. Check for the `.env` file
2. Login to GitLab Container Registry
3. Build the frontend and backend Docker images
4. Push the images to GitLab Container Registry

### Local Deployment

To deploy the application locally:

```bash
./deploy.sh local
```

This will:
1. Check for the `.env` file
2. Deploy both frontend and backend containers using docker-compose
3. Map the frontend to port 3000 and the backend to port 5001

To deploy only the frontend:

```bash
./deploy.sh local-frontend
```

### Server Deployment Files

To generate deployment files for a server:

```bash
./deploy.sh server-files
```

This will create a `server-deploy` directory containing:
1. A docker-compose.yml file configured for server deployment
2. A deploy.sh script for the server
3. An example .env file

## Manual Deployment

### Building Docker Images

Frontend:
```bash
docker build -t registry.gitlab.com/reka-dev/underground/antara/frontend:latest -f Dockerfile.frontend .
```

Backend:
```bash
docker build -t registry.gitlab.com/reka-dev/underground/antara/backend:latest .
```

### Pushing to GitLab Container Registry

Login:
```bash
docker login registry.gitlab.com
```

Push frontend:
```bash
docker push registry.gitlab.com/reka-dev/underground/antara/frontend:latest
```

Push backend:
```bash
docker push registry.gitlab.com/reka-dev/underground/antara/backend:latest
```

### Deploying with Docker Compose

Create a docker-compose.yml file:

```yaml
services:
  frontend:
    image: registry.gitlab.com/reka-dev/underground/antara/frontend:latest
    platform: linux/amd64
    ports:
      - "3000:80"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
      - VITE_SUPABASE_SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY}
      - VITE_API_BASE_URL=http://backend:5001
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  backend:
    image: registry.gitlab.com/reka-dev/underground/antara/backend:latest
    platform: linux/amd64
    ports:
      - "5001:5001"
    volumes:
      - device-workspaces:/app/workspaces
      - ./logs:/app/logs
    environment:
      - FLASK_ENV=production
      - FLASK_APP=device_api.py
      - GITLAB_USERNAME=${GITLAB_USERNAME}
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

volumes:
  device-workspaces:
    driver: local
```

Then run:
```bash
docker-compose up -d
```

### Running Individual Containers

Frontend only:
```bash
docker run -d -p 3000:80 \
  -e VITE_SUPABASE_URL=your_value \
  -e VITE_SUPABASE_ANON_KEY=your_value \
  -e VITE_SUPABASE_SERVICE_ROLE_KEY=your_value \
  -e VITE_API_BASE_URL=http://your_backend_url:5001 \
  --name antara-frontend \
  registry.gitlab.com/reka-dev/underground/antara/frontend:latest
```

Backend only:
```bash
docker run -d -p 5001:5001 \
  -e FLASK_ENV=production \
  -e FLASK_APP=device_api.py \
  -e GITLAB_USERNAME=your_username \
  -e GITLAB_TOKEN=your_token \
  -e VITE_SUPABASE_URL=your_value \
  -e VITE_SUPABASE_SERVICE_ROLE_KEY=your_value \
  -v /path/on/host/workspaces:/app/workspaces \
  -v /path/on/host/logs:/app/logs \
  --name antara-backend \
  registry.gitlab.com/reka-dev/underground/antara/backend:latest
```

## Updating Deployed Containers

To update to the latest images:

```bash
docker-compose pull
docker-compose up -d
```

## Troubleshooting

### Container Health Checks

The containers include health checks to verify they're running correctly. Check container health with:

```bash
docker ps
```

Look for `(healthy)` in the status column.

### Viewing Logs

Frontend logs:
```bash
docker logs antara-frontend-1
```

Backend logs:
```bash
docker logs antara-backend-1
```

### Common Issues

1. **Port conflicts**: If ports 3000 or 5001 are already in use, modify the port mappings in docker-compose.yml.

2. **Environment variables**: Ensure all required environment variables are set in your .env file.

3. **GitLab authentication**: If you can't push or pull images, check your GitLab credentials and ensure you have access to the repository.

4. **API connection issues**: If the frontend can't connect to the backend, check that the VITE_API_BASE_URL is set correctly.

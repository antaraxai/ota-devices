#!/bin/bash
# Antara Docker Build and Deploy Script
# For GitLab Container Registry

# Exit on error
set -e

# Configuration
REGISTRY="registry.gitlab.com"
NAMESPACE="reka-dev/underground"
PROJECT="antara"
IMAGE_NAME="$REGISTRY/$NAMESPACE/$PROJECT"
VERSION=$(date +"%Y%m%d%H%M")  # Using timestamp as version

echo "🚀 Building and deploying Antara to GitLab Container Registry"
echo "🔧 Image: $IMAGE_NAME"
echo "📦 Version: $VERSION"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check if user is logged in to GitLab registry
echo "🔑 Checking GitLab registry authentication..."
if ! docker login $REGISTRY; then
  echo "❌ Error: Failed to authenticate with GitLab registry."
  echo "Please run 'docker login $REGISTRY' manually and try again."
  exit 1
fi

# Build for multiple platforms (ARM for M1 and x86 for compatibility)
echo "🏗️ Building multi-architecture Docker image..."
docker buildx create --name antara-builder --use || true
docker buildx inspect --bootstrap

# Build and push the image
echo "🔨 Building and pushing frontend image: $IMAGE_NAME/frontend:$VERSION and $IMAGE_NAME/frontend:latest"
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $IMAGE_NAME/frontend:$VERSION \
  -t $IMAGE_NAME/frontend:latest \
  --push \
  -f Dockerfile.frontend \
  .

echo "✅ Successfully built and pushed Docker image to GitLab Container Registry"
echo "📋 Image details:"
echo "  - Repository: $IMAGE_NAME/frontend"
echo "  - Tags: latest, $VERSION"
echo ""
echo "🌐 You can pull this image using:"
echo "  docker pull $IMAGE_NAME/frontend:latest"
echo ""
echo "🚀 Frontend deployment completed successfully!"

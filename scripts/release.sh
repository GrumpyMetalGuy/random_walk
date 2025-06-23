#!/bin/bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository!"
    exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Ask for new version if not provided
if [ -z "$1" ]; then
    echo -n "Enter new version (current: $CURRENT_VERSION): "
    read NEW_VERSION
else
    NEW_VERSION=$1
fi

# Validate version format
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format. Use semantic versioning (e.g., 1.0.0)"
    exit 1
fi

print_status "Updating to version: $NEW_VERSION"

# Update package.json files
print_status "Updating package.json versions..."
npm version $NEW_VERSION --no-git-tag-version
cd frontend && npm version $NEW_VERSION --no-git-tag-version && cd ..
cd backend && npm version $NEW_VERSION --no-git-tag-version && cd ..

# Update docker-compose.yml
print_status "Updating docker-compose.yml..."
sed -i.bak "s|image: yourusername/random-walk:.*|image: yourusername/random-walk:v$NEW_VERSION|g" docker-compose.yml
rm -f docker-compose.yml.bak

# Build Docker image
print_status "Building Docker image..."
DOCKER_TAG="yourusername/random-walk"  # Replace with your DockerHub username

if ! docker build -f backend/Dockerfile -t "$DOCKER_TAG:v$NEW_VERSION" -t "$DOCKER_TAG:latest" .; then
    print_error "Docker build failed!"
    exit 1
fi

print_success "Docker image built successfully: $DOCKER_TAG:v$NEW_VERSION"

# Ask if user wants to push to DockerHub
echo -n "Push to DockerHub? (y/N): "
read PUSH_CONFIRM

if [[ $PUSH_CONFIRM =~ ^[Yy]$ ]]; then
    print_status "Pushing to DockerHub..."
    
    if ! docker push "$DOCKER_TAG:v$NEW_VERSION"; then
        print_error "Failed to push versioned image!"
        exit 1
    fi
    
    if ! docker push "$DOCKER_TAG:latest"; then
        print_error "Failed to push latest image!"
        exit 1
    fi
    
    print_success "Images pushed to DockerHub successfully!"
fi

# Commit changes and create git tag
print_status "Committing changes and creating git tag..."
git add .
git commit -m "Release v$NEW_VERSION

- Updated package.json versions to $NEW_VERSION
- Updated docker-compose.yml to use v$NEW_VERSION
- Built and tagged Docker image"

git tag "v$NEW_VERSION"

print_success "Release v$NEW_VERSION completed!"
print_status "Don't forget to push your changes and tags:"
print_status "  git push origin main"
print_status "  git push origin v$NEW_VERSION"

# Show summary
echo
print_status "Release Summary:"
echo "  - Version: $NEW_VERSION"
echo "  - Docker Image: $DOCKER_TAG:v$NEW_VERSION"
echo "  - Git Tag: v$NEW_VERSION"
echo "  - Commit: $(git rev-parse --short HEAD)" 
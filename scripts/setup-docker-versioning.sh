#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo "🐳 Docker Versioning Setup for Random Walk"
echo "=========================================="
echo

# Get DockerHub username
echo -n "Enter your DockerHub username: "
read DOCKERHUB_USERNAME

if [ -z "$DOCKERHUB_USERNAME" ]; then
    print_error "DockerHub username is required!"
    exit 1
fi

print_status "Setting up Docker versioning with username: $DOCKERHUB_USERNAME"

# Update GitHub Actions workflow
if [ -f ".github/workflows/docker-publish.yml" ]; then
    print_status "Updating GitHub Actions workflow..."
    sed -i.bak "s|yourusername/random-walk|$DOCKERHUB_USERNAME/random-walk|g" .github/workflows/docker-publish.yml
    rm -f .github/workflows/docker-publish.yml.bak
    print_success "Updated .github/workflows/docker-publish.yml"
fi

# Update package.json scripts
print_status "Updating package.json scripts..."
sed -i.bak "s|yourusername/random-walk|$DOCKERHUB_USERNAME/random-walk|g" package.json
rm -f package.json.bak
print_success "Updated package.json scripts"

# Update release script
if [ -f "scripts/release.sh" ]; then
    print_status "Updating release script..."
    sed -i.bak "s|yourusername/random-walk|$DOCKERHUB_USERNAME/random-walk|g" scripts/release.sh
    rm -f scripts/release.sh.bak
    print_success "Updated scripts/release.sh"
fi

# Update docker-compose.yml
print_status "Updating docker-compose.yml..."
sed -i.bak "s|yourusername/random-walk|$DOCKERHUB_USERNAME/random-walk|g" docker-compose.yml
rm -f docker-compose.yml.bak
print_success "Updated docker-compose.yml"

echo
print_success "Setup completed! 🎉"
echo
print_status "Next steps:"
echo "1. 🔐 Set up GitHub Secrets (for automated CI/CD):"
echo "   - Go to GitHub repo → Settings → Secrets and variables → Actions"
echo "   - Add these secrets:"
echo "     - DOCKERHUB_USERNAME: $DOCKERHUB_USERNAME"
echo "     - DOCKERHUB_TOKEN: <your-dockerhub-access-token>"
echo
echo "2. 📦 Manual release options:"
echo "   - Run: npm run release (for interactive release)"
echo "   - Run: ./scripts/release.sh 1.0.1 (for specific version)"
echo
echo "3. 🤖 Automatic release (GitHub Actions):"
echo "   - Push a git tag: git tag v1.0.1 && git push origin v1.0.1"
echo "   - Or use: npm version patch && git push --follow-tags"
echo
print_warning "Remember to create a DockerHub access token at: https://hub.docker.com/settings/security" 
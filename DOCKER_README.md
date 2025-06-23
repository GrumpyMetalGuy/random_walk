# Random Walk Docker Image

A containerized location discovery application that helps you find interesting places within walking distance.

## Quick Start

```bash
# Just works - completely self-contained
docker run -d \
  --name random-walk \
  -p 4000:4000 \
  -v random-walk_data:/app/data \
  yourusername/random-walk:latest
```

## Access the Application

- **Application**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

The setup screen will appear on first visit to create your admin account.

## Docker Compose

The repository includes a ready-to-use `docker-compose.yml` file:

```bash
# Simple usage with Docker Compose
docker-compose up -d
```

Contents of `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    image: yourusername/random-walk:v1.0.0  # Replace with your DockerHub username
    ports:
      - "4000:4000"
    volumes:
      - random-walk_data:/app/data
    restart: unless-stopped
volumes:
  random-walk_data:
```

**Note**: No environment variables needed! The container is fully self-contained with secure defaults.

## Data Persistence

Data is stored in `/app/data/randomwalk.db` inside the container. Mount a volume to persist data across container restarts.

## Health Check

The application includes a health check endpoint at `/health` that returns `{"status":"ok"}`.

## Security

- **JWT Secret**: Container auto-generates one if not provided, but **always set your own in production**
- Generate strong JWT secret: `openssl rand -base64 64`
- Use HTTPS in production
- Set strong admin passwords (20+ characters)

## Source Code

Full source code and documentation: [GitHub Repository URL] 
# Random Walk Docker Image

A containerized location discovery application that helps you find interesting places within walking distance.

> **Note:** there is no published pre-built image. Build the image locally from the repository before running any of the commands below.
>
> The recommended way is the npm helper, which reads the version from the root `package.json` and tags the image as **both** `random-walk:v<version>` and `random-walk:latest` in one shot:
>
> ```bash
> git clone https://github.com/GrumpyMetalGuy/random_walk.git
> cd random_walk
> npm run docker:build
> ```
>
> If you'd rather not have Node installed, the equivalent raw command is:
>
> ```bash
> docker build -t random-walk:v1.1.0 -t random-walk:latest .
> ```
>
> A bare `docker build .` (or `docker compose build`) only produces a single `random-walk:latest` tag — no versioned tag, since plain `docker build` doesn't read `package.json`.

## Quick Start

```bash
# Run the locally-built image
docker run -d \
  --name random-walk \
  -p 4000:4000 \
  -v random-walk_data:/app/data \
  random-walk:latest
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
services:
  app:
    build: .
    image: random-walk:latest
    ports:
      - "4000:4000"
    volumes:
      - random-walk_data:/app/data
    restart: unless-stopped
volumes:
  random-walk_data:
```

## Data Persistence

Data is stored in `/app/data/randomwalk.db` inside the container. Mount a volume to persist data across container restarts.

## Health Check

The application includes a health check endpoint at `/health` that returns `{"status":"ok"}`.

## Security

- **JWT Secret (required in production)**  
  - The container will auto-generate a secret if not provided (good for quick tests).  
  - In production, set a fixed `JWT_SECRET` so tokens remain valid across restarts and replicas.  
  - Generate a strong secret: `openssl rand -base64 64`

  Docker Compose:
  ```yaml
  services:
    app:
      environment:
        - JWT_SECRET=${JWT_SECRET}
  ```
  `.env`:
  ```env
  JWT_SECRET=$(openssl rand -base64 64)
  ```

  Docker run:
  ```bash
  docker run -d \
    --name random-walk \
    -p 4000:4000 \
    -e JWT_SECRET="$(openssl rand -base64 64)" \
    -v random-walk_data:/app/data \
    random-walk:latest
  ```

  Kubernetes:
  ```yaml
  env:
    - name: JWT_SECRET
      valueFrom:
        secretKeyRef:
          name: random-walk-secrets
          key: jwt-secret
  ```

- Use HTTPS in production
- Set strong admin passwords (20+ characters)

## Source Code

Full source code and documentation: <https://github.com/GrumpyMetalGuy/random_walk>

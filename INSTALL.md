# Random Walk Installation Guide

## Prerequisites

- Docker and Docker Compose installed on your system (or Node.js 18+ for local development)
- Git installed
- Basic knowledge of terminal/command line operations

## Development Setup

1. Clone the repository:
```bash
git clone <your-repository-url>
cd random-walk
```

2. The application works out of the box with no configuration needed.

**Note**: The application serves both frontend and backend from the same origin, with all security settings optimized for production deployment.

3. Start the application:
```bash
docker-compose up -d
```

The application will be available at:
- **Application**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

### Alternative: Local Development (No Docker)
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Build and start
npm run build && npm start
```

4. **First-Run Setup**:
   - Navigate to http://localhost:4000
   - You'll be prompted to create an admin account
   - Choose a secure username and password (20+ characters required)
   - Complete the location setup wizard
   - Start exploring places!

## Production Deployment

1. Create a `docker-compose.yml` file on your production server:
```yaml
version: '3.8'

services:
  app:
    image: yourusername/random-walk:v1.0.0  # Replace with actual DockerHub username
    ports:
      - "4000:4000"
    volumes:
      - random-walk_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  random-walk_data:
```

2. Start the application:
```bash
docker-compose up -d
```

**Alternative: Build from source (if you want to customize)**
```bash
# Only needed if you want to modify the code
git clone <your-repository-url>
cd random-walk
docker-compose build
docker-compose up -d
```

The application will be available at:
- **Application**: http://localhost:4000 (configure your reverse proxy accordingly)

**✨ Automatic Database Setup**: The backend automatically handles:
- Database file creation
- Schema migrations
- Initial data seeding
- Connection testing

You'll see logs like:
```
🔍 Checking database status...
📂 Database file not found, creating new database...
🚀 Running database migrations...
✅ Database migrations completed
🌱 Seeding database with initial data...
✅ Database seeded successfully
🎉 Database initialized successfully!
🚀 Server running at http://localhost:4000
```

5. **Access the application**:
   - **Application**: http://localhost:4000 (Setup screen will appear for new installations)
   - **Health Check**: http://localhost:4000/health

6. **Create your admin account**:
   - The setup screen will automatically appear on first visit
   - Choose a username and password (20+ characters)
   - You'll be automatically logged in as admin

## Authentication & User Management

### Admin Account Setup
- The first user created becomes an admin automatically
- Admin users can create additional users through the admin panel
- Only admin users can export data and manage system settings

### User Roles
- **Admin**: Full access including user management and data export
- **User**: Can discover places, plan visits, and manage their own activities

### Password Requirements
- **Minimum 20 characters** (designed for password managers)
- No complexity requirements (length provides security)
- Passwords are hashed with Argon2id for maximum security

## Data Persistence

The application uses a SQLite database stored in a Docker volume named `random-walk_data`. This ensures your data persists across container restarts and updates.

**Database File**: The database is named `randomwalk.db`.

To backup the database:
```bash
# Find the volume location
docker volume inspect random-walk_data

# Copy the database file from the volume
docker cp <container-id>:/app/data/randomwalk.db ./backup/

# Include the backup timestamp
docker cp <container-id>:/app/data/randomwalk.db ./backup/randomwalk-backup-$(date +%Y%m%d-%H%M%S).db
```

## Production Configuration

### Nginx Reverse Proxy

If you're using Nginx as a reverse proxy, here's a sample configuration:

```nginx
# Random Walk Application
server {
    listen 80;
    server_name your-domain.com;

    # Increase body size for data imports/exports
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important for authentication cookies
        proxy_set_header Cookie $http_cookie;
        
        # WebSocket support (if needed in future)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint (optional, for monitoring)
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
}
```

**Benefits**:

- Single domain/port to manage
- No cross-origin issues
- Simplified SSL certificate setup
- Single service to monitor

### SSL Configuration

For production, you **must** secure your application with SSL for authentication security:

1. Install certbot
2. Obtain certificates:

```bash
certbot --nginx -d your-domain.com
```

## Security Considerations

### JWT Secret Management
- **Automatically managed** - JWT secrets are auto-generated securely
- **No user configuration needed** - Secrets are unique per container instance
- **Production ready** - Uses 64-character cryptographically secure random secrets

### Database Security
- Ensure proper file permissions on the SQLite database
- Regular database backups with encryption
- Monitor database access logs

### User Account Security
- Enforce strong passwords (20+ character minimum)
- Regular audit of user accounts and permissions
- Monitor login attempts and failures

## Monitoring and Maintenance

1. View container logs:
```bash
# All containers
docker-compose logs

# Specific service
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app
```

2. Container management:
```bash
# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# Update containers (after pulling new image)
docker-compose pull
docker-compose up -d

# Or rebuild locally
docker-compose build
docker-compose up -d
```

3. Database management:
```bash
# Access Prisma Studio (development only)
cd backend && npx prisma studio

# Run database migrations (if needed)
cd backend && npx prisma migrate deploy

# View database schema
cd backend && npx prisma db pull
```

## Troubleshooting

### ❌ **"Cannot Connect" Issues**

If the containers build but you can't connect, try these steps:

1. **Check containers are running**:
```bash
docker-compose ps
```
You should see the `app` service as "Up".

2. **Check container logs**:
```bash
# Application logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f
```

3. **Verify ports are accessible**:
```bash
# Test backend directly
curl http://localhost:4000/health

# Should return: {"status":"ok"}
```

4. **Common fixes**:

   **Problem**: Port already in use
   ```bash
   # Stop any local dev servers first
   pkill -f "npm run dev"
   pkill -f "tsx watch"
   
   # Then restart containers
   docker-compose down
   docker-compose up
   ```

   **Problem**: Database connection errors
   ```bash
   # Recreate the database volume
   docker-compose down -v
   docker-compose up
   ```

   **Problem**: Application not accessible
   - Check that the server shows "Server running at http://localhost:4000" in logs
   - Verify the application is accessible at http://localhost:4000

### 🔧 **Reset Everything**
If you're still having issues:

```bash
# Stop and remove everything
docker-compose down -v --remove-orphans

# Remove Docker build cache
docker system prune -f

# Rebuild from scratch  
docker-compose build --no-cache
docker-compose up
```

### 🌐 **Network Access**
- **Application**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

### 📝 **Expected Logs**
When working correctly, you should see:
- Server: "Server running at http://localhost:4000"
- No error messages about ECONNREFUSED or port conflicts

### 🔍 **Debug Commands**
```bash
# Check what's using port 4000
sudo netstat -tulnp | grep :4000

# Inspect running container
docker-compose exec app sh
```

## Data Export & GDPR Compliance

### Data Export
Admin users can export all application data:
- Navigate to Admin panel
- Use "Export Data" feature
- Download JSON file with all users, places, and settings

### Data Deletion
Admin users can delete all user data:
- Use with extreme caution
- Creates complete data export before deletion
- Irreversible operation

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# Daily backup script
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d-%H%M%S)
docker cp random-walk-app-1:/app/data/randomwalk.db "$BACKUP_DIR/randomwalk-$DATE.db"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "randomwalk-*.db" -mtime +30 -delete
```

### Recovery
```bash
# Stop the application
docker-compose down

# Restore database
docker cp backup/randomwalk-backup-YYYYMMDD-HHMMSS.db random-walk-app-1:/app/data/randomwalk.db

# Restart application
docker-compose up -d
```

## Support

For additional support or to report issues, please create an issue in the project's repository. Include:
- Environment details (development/production)
- Container logs
- Steps to reproduce any issues
- Authentication-related errors (without exposing sensitive information)

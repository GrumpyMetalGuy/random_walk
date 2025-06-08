# Random Walk Installation Guide

## Prerequisites

- Docker and Docker Compose installed on your system
- Git installed
- Basic knowledge of terminal/command line operations
- **Strong JWT secret** for production deployment (64+ characters recommended)

## Development Setup

1. Clone the repository:
```bash
git clone <your-repository-url>
cd random-walk
```

2. Create a `.env` file in the root directory:
```bash
# Development environment variables
NODE_ENV=development
DATABASE_URL=file:/app/data/randomwalk.db
CORS_ORIGIN=http://localhost:3000
PORT=4000
VITE_API_URL=http://localhost:4000
JWT_SECRET=your-development-jwt-secret-make-it-long-and-random
```

**Important**: Generate a strong JWT secret even for development. You can use:
```bash
# Generate a random JWT secret
openssl rand -base64 64
```

3. Start the development environment:
```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Prisma Studio: http://localhost:5556 (when started)

4. **First-Run Setup**:
   - Navigate to http://localhost:3000
   - You'll be prompted to create an admin account
   - Choose a secure username and password (20+ characters required)
   - Complete the location setup wizard
   - Start exploring places!

## Production Deployment

1. Clone the repository on your production server:
```bash
git clone <your-repository-url>
cd random-walk
```

2. Create a production `.env` file:
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=file:/app/data/randomwalk.db
PORT=4000
# Update these values for your production environment
CORS_ORIGIN=https://your-domain.com
VITE_API_URL=https://api.your-domain.com
# CRITICAL: Use a strong, unique JWT secret in production
JWT_SECRET=your-super-long-random-production-jwt-secret-64-plus-characters
```

**Security Critical**: Generate a unique, strong JWT secret for production:
```bash
# Generate a production JWT secret
openssl rand -base64 64 | tr -d '\n'
```

3. Build and start the production containers:
```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

The application will be available at:
- Frontend: http://localhost:3000 (configure your reverse proxy accordingly)
- Backend API: http://localhost:4000 (configure your reverse proxy accordingly)

4. **Production First-Run Setup**:
   - Access your domain/frontend URL
   - Complete the admin account creation
   - **Important**: Use a very strong password (20+ characters) for the admin account
   - Configure your home location
   - The application is now ready for use

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

**Database File**: The database is now named `randomwalk.db` (updated from the previous `placefinder.db`)

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
# Frontend
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important for authentication cookies
        proxy_set_header Cookie $http_cookie;
    }
}
```

### SSL Configuration

For production, you **must** secure your application with SSL for authentication security:

1. Install certbot
2. Obtain certificates:
```bash
certbot --nginx -d your-domain.com -d api.your-domain.com
```

3. Update your `.env` file:
```bash
CORS_ORIGIN=https://your-domain.com
VITE_API_URL=https://api.your-domain.com
```

### Environment Variables

Critical environment variables for production:

- `CORS_ORIGIN`: Set to your frontend domain (HTTPS required)
- `VITE_API_URL`: Set to your backend API domain (HTTPS required)
- `JWT_SECRET`: **CRITICAL** - Use a strong, unique secret (64+ characters)
- `NODE_ENV`: Set to `production`

## Security Considerations

### JWT Secret Management
- **Never commit JWT secrets to version control**
- Use different secrets for development and production
- Store production secrets securely (environment variables, secret management)
- Rotate JWT secrets periodically for enhanced security

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
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f backend
```

2. Container management:
```bash
# Stop containers
docker-compose -f docker-compose.prod.yml down

# Restart containers
docker-compose -f docker-compose.prod.yml restart

# Update containers (after pulling new code)
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
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

1. **Authentication Issues**:
   - Check JWT_SECRET is set and consistent
   - Verify CORS_ORIGIN matches your frontend domain
   - Ensure cookies are properly configured for HTTPS
   - Check browser developer tools for authentication errors

2. **Frontend can't connect to backend**:
   - Check the `VITE_API_URL` environment variable
   - Verify the backend container is running
   - Check CORS settings in the backend
   - Ensure both frontend and backend use HTTPS in production

3. **Database Issues**:
   - Verify the Docker volume is properly mounted
   - Check the database file permissions
   - Ensure the database file is named `randomwalk.db`
   - Check migration status with `npx prisma migrate status`

4. **Container Issues**:
   - Check container logs for specific error messages
   - Verify all required environment variables are set
   - Ensure ports are not already in use
   - Check Docker volume mounts and permissions

5. **First-Run Setup Problems**:
   - Clear browser cache and cookies
   - Check backend logs for setup errors
   - Verify database is accessible and writable
   - Ensure no existing admin accounts conflict

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
docker cp random-walk-backend-1:/app/data/randomwalk.db "$BACKUP_DIR/randomwalk-$DATE.db"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "randomwalk-*.db" -mtime +30 -delete
```

### Recovery
```bash
# Stop the application
docker-compose -f docker-compose.prod.yml down

# Restore database
docker cp backup/randomwalk-backup-YYYYMMDD-HHMMSS.db random-walk-backend-1:/app/data/randomwalk.db

# Restart application
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For additional support or to report issues, please create an issue in the project's repository. Include:
- Environment details (development/production)
- Container logs
- Steps to reproduce any issues
- Authentication-related errors (without exposing sensitive information) 
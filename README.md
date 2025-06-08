# Random Walk

Random Walk is a secure web application that helps users discover and track interesting places to visit around their location through randomly generated walking routes. Using OpenStreetMap data, it provides a curated list of places like parks, tourist attractions, towns, and cities, with individual user accounts and role-based access control.

## Features

### 🔐 **Authentication & User Management**
  - **Secure user accounts** with username/password authentication
  - **Role-based access control**: Admin and User roles
  - **First-run setup** with admin account creation
  - **JWT token authentication** with 30-day expiration and remember me option
  - **Password security** with Argon2id hashing and 20-character minimum requirement
  - **User management** for admins to create and manage user accounts

### 🗺️ **Place Discovery & Management**
  - Search for places within customizable distances (5-40 miles)
  - Filter by place types (parks, tourist attractions, towns, cities, playgrounds)
  - Get random place suggestions
  - International location support with country-specific filtering
  - Track places with three states: Available, Planning to Visit, and Visited
  - Plan and unplan visits
  - Mark places as visited/unvisited
  - **Shared place visits** between all users

### 🏠 **Smart Location Handling**
  - Automatic country detection from home address
  - OpenStreetMap geocoding integration
  - Support for What3Words location format
  - Distance-based and bounding box search

### 👨‍💼 **Admin Features**
  - **Data overview dashboard** with user, place, and setting statistics
  - **User management** with ability to create new users
  - **Data export** (JSON format) for GDPR compliance
  - **Data deletion** capabilities
  - **System settings** management

## Quick Start

1. **Prerequisites**
   - Docker and Docker Compose
   - Git
   - Basic terminal knowledge

2. **Installation**
   ```bash
   # Clone the repository
   git clone <your-repository-url>
   cd random-walk

   # Create environment file
   cat > .env << EOL
   NODE_ENV=development
   DATABASE_URL=file:/app/data/randomwalk.db
   CORS_ORIGIN=http://localhost:3000
   PORT=4000
   VITE_API_URL=http://localhost:4000
   JWT_SECRET=your-jwt-secret-here-make-it-long-and-random
   EOL

   # Start the application
   docker-compose up -d
   ```

3. **First-Run Setup**
   - Frontend: http://localhost:3000
   - Follow the setup wizard to create your admin account
   - Complete home location setup
   - Start discovering places!

4. **Access Points**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

## Development

### Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS
- **Backend**: Node.js with Express, TypeScript
- **Database**: SQLite with Prisma ORM v6.9.0
- **Authentication**: JWT with Argon2id password hashing
- **Testing**: Jest and React Testing Library
- **Containerization**: Docker

### Running Tests
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend
```

### Development Mode
```bash
# Start development servers
npm run dev

# Start frontend only
npm run dev:frontend

# Start backend only
npm run dev:backend
```

### Database Management
```bash
# View database in Prisma Studio
cd backend && npx prisma studio

# Reset database (development only)
cd backend && npx prisma migrate reset

# Create new migration
cd backend && npx prisma migrate dev --name your-migration-name
```

## User Roles & Permissions

### Admin Users
- Full access to all features
- User management (create, view users)
- Data export and deletion
- System settings management
- Place and visit management

### Regular Users
- Place discovery and search
- Visit planning and tracking
- Profile management
- Shared access to place data

## Security Features

- **Argon2id password hashing** with optimized security parameters
- **JWT authentication** with HTTP-only cookies for remember me
- **20-character minimum passwords** (assuming password manager usage)
- **Role-based authorization** middleware
- **Input validation** with Zod schemas
- **CORS protection** with credential support
- **Rate limiting** on authentication endpoints

## Production Deployment

For production deployment instructions and configuration, please refer to [INSTALL.md](INSTALL.md).

## API Documentation

The application provides several API endpoints for authentication, places, settings, and user management:

### Authentication
- **POST** `/api/auth/setup` - Create initial admin account
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/logout` - User logout
- **GET** `/api/auth/me` - Get current user info
- **GET** `/api/auth/setup-status` - Check if setup is complete

### Places & Locations
- **GET** `/api/places` - Get all places
- **POST** `/api/places/random` - Get random places
- **POST** `/api/places/:id/plan` - Plan to visit
- **POST** `/api/places/:id/visit` - Mark as visited
- **POST** `/api/location/validate` - Validate location

### Admin Only
- **POST** `/api/auth/register` - Create new user
- **GET** `/api/admin/export` - Export all data
- **DELETE** `/api/admin/delete-all-data` - Delete all data
- **GET** `/api/admin/data-summary` - Get data overview

For detailed API documentation, please refer to [SPEC.md](SPEC.md).

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

The application includes comprehensive test coverage:
- Unit tests for core functionality
- Integration tests for API endpoints
- Authentication and authorization tests
- End-to-end tests for critical user journeys
- Performance testing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please create an issue in the project's repository.

## Environment Variables

The application uses the following environment variables:

### Development
```bash
NODE_ENV=development
DATABASE_URL=file:/app/data/randomwalk.db
CORS_ORIGIN=http://localhost:3000
PORT=4000
VITE_API_URL=http://localhost:4000
JWT_SECRET=your-super-secret-jwt-key-here
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=file:/app/data/randomwalk.db
CORS_ORIGIN=https://your-domain.com
VITE_API_URL=https://api.your-domain.com
JWT_SECRET=your-production-jwt-secret-very-long-and-random
```

**Important**: Always use a strong, unique `JWT_SECRET` in production. Generate a random 64+ character string.

For detailed deployment configuration, please refer to [INSTALL.md](INSTALL.md). 
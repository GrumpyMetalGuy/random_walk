# Random Walk

LLM-generated project that goes with the article located at https://www.grumpymetalguy.com/programming/random_walk_vibes . Everything below this is LLM generated.

***

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
  - **Configurable minimum spacing** between search results to avoid clustered duplicates (defaults to half the user's basic distance unit)
  - **Optional re-suggestion** of previously visited places via an opt-in checkbox on the search form
  - International location support with country-specific filtering
  - Track places with four states: Available, Planning to Visit, Visited, and Ignored
  - Plan and unplan visits
  - Mark places as visited/unvisited
  - **Free-text notes** on visited and ignored places, editable inline from the Places page
  - **Search filter on the Places page** narrows visited and ignored entries by name, place type, description, or notes
  - **One-click address copy**: each suggestion's address is rendered as a clickable link that copies it to the clipboard for pasting into the user's preferred maps/sat-nav app
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
   - Docker and Docker Compose (or Node.js 20+ for local development)
   - Git
   - Basic terminal knowledge

2. **Installation**
   ```bash
   # Clone the repository
   git clone <your-repository-url>
   cd random-walk

   # Create environment file
   cat > .env << EOL
   NODE_ENV=production
   DATABASE_URL=file:/app/data/randomwalk.db
   PORT=4000
   JWT_SECRET=$(openssl rand -base64 32)
   EOL

   # Start the application
   docker-compose up
   ```

   **✨ Database Auto-Setup**: The application will automatically:
   - Create the database file if it doesn't exist
   - Run all necessary migrations
   - Seed initial data
   - No manual database setup required!

3. **Access the application**:
   - **Full Application**: http://localhost:4000
   - **Health Check**: http://localhost:4000/health
   - **API Endpoints**: http://localhost:4000/api/*

4. **First-Run Setup**:
   On your first visit, you'll see a setup screen to create the initial admin account. The database initialization happens automatically - just create your admin user and start using the app!

### Local Development (without Docker)
```bash
# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Build and start the application
npm run build && npm start
```

## Development

### Project Structure
```
random-walk/
├── frontend/               # React TypeScript frontend
│   ├── src/               # Source code
│   ├── vitest.config.ts   # Vitest configuration
│   └── package.json       # Frontend dependencies
├── backend/               # Node.js TypeScript backend  
│   ├── src/               # Source code
│   ├── data/              # SQLite database location
│   ├── public/            # Built frontend assets (auto-generated)
│   ├── prisma/            # Database schema and migrations
│   ├── jest.config.ts     # Jest configuration
│   └── package.json       # Backend dependencies
├── docker-compose*.yml    # Docker configurations
└── package.json           # Root scripts and coordination
```

### Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS
- **Backend**: Node.js with Express, TypeScript
- **Database**: SQLite with Prisma ORM v6.9.0
- **Authentication**: JWT with Argon2id password hashing
- **Testing**: Vitest (frontend) and Jest (backend) with React Testing Library
- **Containerization**: Docker
- **Build System**: Vite (frontend), TypeScript compiler (backend)

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
# Start development server (builds frontend first, then starts backend)
npm run dev

# Or if frontend is already built, watch-only mode
npm run dev:watch

# Or start directly from backend (requires frontend to be pre-built)
cd backend && npm run dev
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
- **Same-origin security** (no CORS needed)
- **Rate limiting** on authentication endpoints

## User Interface

- **Responsive Design**: Works well on desktop and mobile devices
- **Dark Mode Support**: Toggle between light and dark themes
- **Automatic Theme Detection**: On first visit, the app automatically detects and uses your system's color scheme preference (light/dark mode)
- **Theme Indicator**: A small blue dot appears on the theme toggle when following system preferences
- **Theme Reset**: Double-click the theme toggle to reset back to system preference if you've manually changed it

## Production Deployment

For production deployment instructions and configuration, please refer to [INSTALL.md](INSTALL.md).

## JWT secret in production

- Always set a fixed `JWT_SECRET` in production to keep tokens valid across restarts and across multiple instances.
- The container will auto-generate a secret if none is provided (useful for local testing), but this will invalidate sessions on restart and prevents horizontal scaling.

How to set:

- Docker Compose
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

- Docker run
  ```bash
  docker run -d -p 4000:4000 \
    -e JWT_SECRET="$(openssl rand -base64 64)" \
    -v random-walk_data:/app/data \
    random-walk:latest
  ```

- Kubernetes
  ```yaml
  env:
    - name: JWT_SECRET
      valueFrom:
        secretKeyRef:
          name: random-walk-secrets
          key: jwt-secret
  ```

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
- **POST** `/api/places/discover` - Search with category, distance, text, minimum-spacing, and include-visited filters
- **PATCH** `/api/places/:id` - Update editable fields on a place (currently `notes`)
- **POST** `/api/places/:id/plan` - Plan to visit
- **POST** `/api/places/:id/visit` - Mark as visited
- **POST** `/api/places/:id/ignore` - Ignore a place
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
- **Frontend**: Vitest with React Testing Library for component and UI tests
- **Backend**: Jest for unit tests, API endpoint testing, and integration tests
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
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-here
NOMINATIM_EMAIL=your-email@example.com
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=file:/app/data/randomwalk.db
JWT_SECRET=your-production-jwt-secret-very-long-and-random
NOMINATIM_EMAIL=your-email@example.com
```

**Important**: Always use a strong, unique `JWT_SECRET` in production. Generate a random 64+ character string.

For detailed deployment configuration, please refer to [INSTALL.md](INSTALL.md). 

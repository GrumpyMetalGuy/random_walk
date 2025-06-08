# Random Walk Specification

## Overview
Random Walk is a secure web application that helps users discover and track interesting places to visit around their home location through randomly generated walking routes. It features individual user accounts with role-based access control, uses OpenStreetMap data to find places, and allows users to plan and track their visits while encouraging exploration through random walks.

## Core Features

### Authentication & User Management
- **Secure Authentication**: Username/password authentication with JWT tokens
- **Role-Based Access Control**: Admin and User roles with different permissions
- **First-Run Setup**: Guided setup wizard for creating initial admin account
- **Password Security**: Argon2id hashing with 20-character minimum requirements
- **Session Management**: 30-day JWT expiration with remember me functionality
- **User Management**: Admin ability to create and manage user accounts

### Place Discovery
- Search for places within configurable distances
- Filter by place types (parks, tourist attractions, etc.)
- Random selection of places to visit
- Distance-based filtering
- Bounding box search for geographic constraints
- Natural language queries for better place matching

### Place Management
- Three-state visit tracking:
  1. Available - Places discovered but not yet planned
  2. Planning to Visit - Places marked for future visits
  3. Visited - Places already visited
- Ability to plan/unplan visits
- Mark places as visited/unvisited
- View place details including distance and description
- **Shared place data** between all users

### Location Management
- Home location setting with address validation
- Geocoding support via OpenStreetMap
- Country code detection and storage from home address
- Optional country-specific place filtering
- Support for discovering places internationally

### Admin Features
- **Data Overview Dashboard**: Statistics on users, places, and settings
- **User Management**: Create new users, view user list
- **Data Export**: JSON export of all data for GDPR compliance
- **Data Deletion**: Ability to delete all user data
- **System Settings Management**: Configure application settings

### Place Types
- Parks and Gardens
- Tourist Attractions
- Towns
- Cities
- Playgrounds

## API Endpoints

### Authentication API
- **POST** `/api/auth/setup` - Create initial admin account (first-run only)
- **POST** `/api/auth/login` - Authenticate user with username/password
- **POST** `/api/auth/logout` - Logout user and clear tokens
- **GET** `/api/auth/me` - Get current authenticated user information
- **GET** `/api/auth/setup-status` - Check if initial setup is complete
- **POST** `/api/auth/register` - Create new user account (admin only)

### Places API
- **GET** `/api/places` - Get all places with visit status
- **POST** `/api/places/random` - Get random places within distance
- **POST** `/api/places/:id/plan` - Plan to visit a place
- **POST** `/api/places/:id/unplan` - Cancel plan to visit
- **POST** `/api/places/:id/visit` - Mark place as visited
- **POST** `/api/places/:id/unvisit` - Unmark place as visited
- **POST** `/api/places/generate` - Generate new places

### Settings API
- **GET** `/api/settings` - Get all settings
- **PUT** `/api/settings` - Update setting

### Location API
- **POST** `/api/location/validate` - Validate location input
- **GET** `/api/location/search` - Search locations via OpenStreetMap
- **GET** `/api/location/what3words/:words` - Convert What3Words to coordinates

### Admin API (Admin Role Required)
- **GET** `/api/admin/data-summary` - Get overview of system data
- **GET** `/api/admin/export` - Export all data as JSON
- **DELETE** `/api/admin/delete-all-data` - Delete all user data

## Authentication & Authorization

### User Roles
- **ADMIN**: Full access to all features including user management and data export
- **USER**: Access to place discovery, visit tracking, and personal features

### Authentication Flow
1. **First-Run Setup**: Create initial admin account if no users exist
2. **Login**: Username/password authentication with JWT token generation
3. **Authorization**: Middleware checks JWT tokens and user roles
4. **Session Management**: 30-day token expiration with HTTP-only cookies for remember me

### Security Measures
- **Argon2id Password Hashing**: Industry-standard password security
- **JWT Tokens**: Secure authentication with configurable expiration
- **Role-Based Middleware**: Route-level authorization checks
- **Input Validation**: Zod schemas for all user inputs
- **Rate Limiting**: Protection against brute force attacks
- **CORS Configuration**: Secure cross-origin requests with credentials

## Default Configuration

### Distance Ranges
- Within 5 miles
- Within 10 miles
- Within 15 miles
- Within 20 miles
- Within 40 miles

### Place Generation Settings
Default number of places to generate:
- Parks: 300
- Tourist Attractions: 100
- Towns: 75
- Cities: 30
- Playgrounds: 150

### Security Settings
- Password minimum length: 20 characters
- JWT token expiration: 30 days
- Remember me cookie: HTTP-only, secure
- Authentication rate limiting: Standard Express rate limits

### Other Settings
- Maximum places in random search: 5
- OpenStreetMap rate limiting: 1.5 seconds between requests
- Search radius conversion: miles to degrees (radius/69 for latitude)

## Database Schema

### User Model
- **id**: Int (Primary Key, Auto Increment)
- **username**: String (Unique, Required)
- **passwordHash**: String (Required, Argon2id hashed)
- **role**: String (Default: "USER", Values: "ADMIN" | "USER")
- **createdAt**: DateTime (Auto-generated)
- **updatedAt**: DateTime (Auto-updated)
- **lastLoginAt**: DateTime (Optional, tracks last login)

### Place Model
- **id**: Int (Primary Key)
- **name**: String
- **description**: String (Optional)
- **locationType**: String
- **latitude**: Float
- **longitude**: Float
- **what3words**: String (Optional)
- **osmId**: String (Optional, Unique)
- **isVisited**: Boolean (Default: false)
- **dateAdded**: DateTime
- **lastVisited**: DateTime (Optional)
- **createdAt**: DateTime
- **updatedAt**: DateTime

### Setting Model
- **key**: String (Primary Key)
- **value**: String
- **createdAt**: DateTime
- **updatedAt**: DateTime

Key types include:
- **home_address**: Coordinates of home location
- **country_code**: Two-letter country code (e.g., 'fr', 'de', 'us')
- **setup_complete**: Boolean flag for initial setup

## Security Considerations
- **Multi-user authentication** with secure password storage
- **Role-based authorization** for admin functions
- **JWT token security** with proper expiration and HTTP-only cookies
- **Input validation** and sanitization for all user inputs
- **Rate limiting** for authentication endpoints
- **CORS protection** with credential support
- **Database security** with Prisma ORM parameterized queries
- **Password requirements** enforced for security (20+ characters)

## GDPR Compliance
- **Data Export**: Admin users can export all data in JSON format
- **Data Deletion**: Admin users can delete all user data
- **User Consent**: Clear indication of data usage and storage
- **Data Minimization**: Only necessary data is collected and stored

## Performance Requirements
- Suitable for Raspberry Pi deployment
- Quick random place selection (<1s)
- Efficient distance calculations
- Optimized database queries with proper indexing
- JWT token validation with minimal overhead

## Development Guidelines
- TypeScript strict mode enabled
- ESLint configuration with security rules
- Prettier code formatting
- Git commit conventions
- Docker best practices
- Comprehensive test coverage requirements
- Security-first development approach

## Testing Strategy
- Unit tests for core functionality
- Integration tests for API endpoints
- **Authentication and authorization tests**
- **Security testing** for JWT tokens and password hashing
- E2E tests for critical user journeys including setup flow
- Performance testing
- **Role-based access testing**

## Deployment Requirements
- Docker container with multi-stage builds
- Environment variables configuration with JWT secret
- Database backup strategy for SQLite
- Logging configuration with security events
- Health check endpoints
- **JWT secret management** in production
- **Database file security** and proper file permissions

## Database Migrations
- **Prisma ORM v6.9.0** for database management
- **Single squashed migration** for clean deployment
- **Database named**: `randomwalk.db` (updated from `placefinder.db`)
- Automatic migration application on container start
- Backup strategies for production data 
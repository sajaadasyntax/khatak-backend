# Khatak Backend API

This is the API server for the Khatak application. It provides endpoints for authentication, order management, user management, and more.

## Technologies Used

- Node.js & Express.js
- Prisma ORM
- PostgreSQL
- JWT for authentication
- bcrypt for password hashing
- Cloudinary for image storage

## Local Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=your_database_connection_string
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=30d
   FRONTEND_URL=http://localhost:3000
   
   # Cloudinary configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. Set up the database with Prisma:
   ```
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Seed the database (optional):
   ```
   npm run prisma:seed
   ```

5. Start the development server:
   ```
   npm run dev
   ```

## Production Deployment Guide

### Prerequisites

- Node.js 16 or higher
- PostgreSQL database
- Domain name with proper DNS settings for api.khatakksa.com

### Deployment Steps

1. Clone the repository:
   ```
   git clone https://github.com/sajaadasyntax/khatak-backend.git
   cd khatak-backend
   ```

2. Install production dependencies:
   ```
   npm install --production
   ```

3. Create a `.env` file with production settings:
   ```
   PORT=5000
   NODE_ENV=production
   DATABASE_URL=your_production_database_url
   JWT_SECRET=your_strong_production_secret
   JWT_EXPIRES_IN=30d
   FRONTEND_URL=https://khatakksa.com
   
   # Cloudinary configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. Generate Prisma client and apply migrations:
   ```
   npm run deploy:prepare
   ```

5. Start the production server:
   ```
   # On Linux/Mac
   npm run prod
   
   # On Windows
   npm run prod:win
   ```

### Deployment Options

#### Using PM2 (Recommended)

Install PM2 globally and use it to manage the Node.js process:

```
npm install -g pm2
pm2 start server.js --name "khatak-api" --env production
pm2 save
pm2 startup
```

#### Setting Up with Nginx

Example Nginx configuration for api.khatakksa.com:

```
server {
    listen 80;
    server_name api.khatakksa.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then secure it with Let's Encrypt.

#### Deploying to Cloud Platforms

This application can be deployed to various cloud platforms:

- **Heroku**: Use the Procfile included in the repository
- **Digital Ocean**: Use the App Platform or deploy to a Droplet
- **AWS**: Deploy to Elastic Beanstalk or EC2
- **Railway/Render/Fly.io**: Follow platform-specific deployment guides

## API Endpoints

### Authentication
- POST `/api/auth/signup` - Register a new user
- POST `/api/auth/login` - Login a user

### Orders
- GET `/api/orders` - Get all orders (filtered based on user role)
- GET `/api/orders/:id` - Get a specific order
- POST `/api/orders` - Create a new order (client only)
- PATCH `/api/orders/:id/status` - Update order status (driver or admin)
- PATCH `/api/orders/:id/accept` - Driver accepts an order
- PATCH `/api/orders/:id/cancel` - Cancel an order (client or admin)

### Users
- GET `/api/users` - Get all users (admin only)
- GET `/api/users/:id` - Get user details
- PATCH `/api/users/:id` - Update user information

### Health Check
- GET `/health` - Check API health status 
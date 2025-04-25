# khatak Backend

This is the API server for the khatak application. It provides endpoints for authentication, order management, and user management.

## Technologies Used

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- bcrypt for password hashing

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/shipping-app
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=90d
   ```

3. Make sure MongoDB is running on your system.

4. Start the server:
   ```
   npm run dev
   ```

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

### Users (Admin Only)
- GET `/api/users` - Get all users 
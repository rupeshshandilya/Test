# REST API with User and Admin Roles

This is a REST API implementation with user and admin roles, featuring WebSocket support for real-time messaging.

## Features

- User and Admin roles with separate Swagger documentation
- User registration with email verification
- Default admin account
- Real-time messaging between users
- Group messaging functionality
- Server-side validation
- Logging with rotation
- Rate limiting

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Set up your environment variables in a `.env` file:
```
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your-jwt-secret"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASS="your-email-password"
```

3. Run database migrations:
```bash
npx prisma migrate dev
```

4. Seed the default admin user:
```bash
yarn seed:admin
```

The default admin credentials are:
- Email: admin@example.com
- Password: Admin@123

**Important**: Change these credentials in production!

## Running the Application

Development mode:
```bash
yarn dev
```

Production mode:
```bash
yarn build
yarn start
```

## API Documentation

- User API documentation: http://localhost:3000/api/docs/user
- Admin API documentation: http://localhost:3000/api/docs/admin 
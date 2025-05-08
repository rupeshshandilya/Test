import express, {
  Express,
  json,
  Request,
  Response,
  NextFunction,
  Router,
} from "express";
import { createServer } from "http";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import ngrok from "ngrok";
import authRoutes from "./routes/auth.routes";
import testRoutes from "./routes/test.routes";
import groupRoutes from "./routes/group.routes";
import messageRoutes from "./routes/message.routes";
import winston from "winston";
import "winston-daily-rotate-file";
import { socketAuthMiddleware } from "./middlewares/socketAuth.middleware";
import { SocketHandler } from "./handlers/socket.handler";
import { apiLimiter } from "./middlewares/rateLimit.middleware";

config();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Test Swagger API Documentation",
      version: "1.0.0",
      description: "API documentation for the Jobs application",
    },
    servers: [
      {
        url: "http://localhost:8000",
        description: "Development server",
      },
      {
        url: process.env.NGROK_URL || "https://your-ngrok-url.ngrok.io",
        description: "Public URL (via ngrok)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.ts"], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
    }),
    new winston.transports.DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

const app: Express = express();
const httpServer = createServer(app);

// Apply general rate limiter to all routes
app.use(apiLimiter);

// Configure CORS
app.use(
  cors({
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.options("*", cors());

// Configure Helmet with less restrictive settings for development
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.socket.io",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// Configure Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  path: "/socket.io/",
});

// Add Socket.IO engine error logging
io.engine.on("connection_error", (err) => {
  console.error(`Socket.IO connection error: ${err.code} - ${err.message}`);
});

// Apply socket authentication middleware
io.use(socketAuthMiddleware);

// Initialize socket handler
new SocketHandler(io);

const PORT = process.env.PORT || 800;
export const prisma = new PrismaClient();

// Error handling middleware
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err.stack);
  res.status(500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};

async function main() {
  app.use(json());

  // Serve static files
  app.use(express.static(path.join(__dirname, "public")));

  // Swagger documentation route
  app.use("/api-docs", swaggerUi.serve as any);
  app.get(
    "/api-docs",
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Test API Swagger Documentation",
    }) as any
  );

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/test", testRoutes);
  app.use("/api/v1/groups", groupRoutes);
  app.use("/api/v1/messages", messageRoutes);

  // Error handling middleware should be last
  app.use(errorHandler);

  httpServer.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);

    // Start ngrok tunnel
    try {
      const url = await ngrok.connect({
        addr: PORT,
        authtoken: process.env.NGROK_AUTH_TOKEN,
      });
      logger.info(`Ngrok tunnel is running at: ${url}`);
      logger.info(`Swagger documentation is available at: ${url}/api-docs`);

      // Update Swagger server URL with ngrok URL
      swaggerOptions.definition.servers[1].url = url;
      app.use("/api-docs", swaggerUi.serve as any);
      app.get(
        "/api-docs",
        swaggerUi.setup(swaggerSpec, {
          explorer: true,
          customCss: ".swagger-ui .topbar { display: none }",
          customSiteTitle: "Test API Swagger Documentation",
        }) as any
      );
    } catch (error) {
      logger.error("Failed to start ngrok tunnel:", error);
    }
  });
}

main()
  .then(async () => {
    await prisma.$connect();
    logger.info("Database connected successfully");
  })
  .catch(async (e) => {
    logger.error("Failed to start server:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

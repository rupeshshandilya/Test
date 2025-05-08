import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../server";

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    // Get token from handshake auth or from the headers
    const token =
      socket.handshake.auth.token ||
      (socket.handshake.headers.authorization &&
        socket.handshake.headers.authorization.split(" ")[1]);

    if (!token) {
      console.log("Socket connection rejected: No token provided");
      return next(new Error("Authentication token required"));
    }

    // Log for debugging
    console.log(
      `Socket authenticating with token: ${token.substring(0, 10)}...`
    );

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string; // Changed from id to userId to match login token
        role: string;
      };

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }, // Changed from id to userId
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        console.log(
          `Socket connection rejected: User not found for ID ${decoded.userId}`
        );
        return next(new Error("User not found"));
      }

      // Store user info in socket
      socket.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Also store user ID in handshake auth for compatibility
      socket.handshake.auth.userId = user.id;

      console.log(`Socket authenticated for user: ${user.email} (${user.id})`);
      next();
    } catch (jwtError) {
      console.log(
        "Socket connection rejected: JWT verification failed",
        jwtError
      );
      return next(new Error("Invalid authentication token"));
    }
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
};

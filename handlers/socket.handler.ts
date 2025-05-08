import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/socketAuth.middleware";
import { MessageService } from "../service/message.service";
import { GroupService } from "../service/group.service";
import { prisma } from "../server";

/**
 * @swagger
 * components:
 *   schemas:
 *     WebSocketMessage:
 *       type: object
 *       properties:
 *         content:
 *           type: string
 *           description: Message content
 *         senderId:
 *           type: string
 *           description: ID of the message sender
 *         receiverId:
 *           type: string
 *           description: ID of the message receiver (for direct messages)
 *         groupId:
 *           type: string
 *           description: ID of the group (for group messages)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Message creation timestamp
 *
 * @swagger
 * tags:
 *   name: WebSocket
 *   description: Real-time messaging using WebSocket
 *
 * @swagger
 * /socket.io:
 *   get:
 *     tags:
 *       - WebSocket
 *     summary: WebSocket connection
 *     description: |
 *       WebSocket connection for real-time messaging.
 *
 *       Events:
 *       - `private_message`: Send a private message to another user
 *       - `group_message`: Send a message to a group
 *       - `join_group`: Join a group chat
 *       - `leave_group`: Leave a group chat
 *
 *       Authentication:
 *       - Requires JWT token in the connection query
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT token for authentication
 */
export class SocketHandler {
  private io: Server;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private groupSockets: Map<string, Set<string>> = new Map(); // groupId -> Set<socketId>

  constructor(io: Server) {
    this.io = io;

    // Add engine-level error logging
    this.io.engine.on("connection_error", (err) => {
      console.error(
        `Socket.IO engine connection error: ${err.code} - ${err.message}`
      );
    });

    this.setupEventHandlers();
    console.log("Socket handler initialized");
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      if (!socket.user) {
        console.log(
          `Socket ${socket.id} connected but has no user data - disconnecting`
        );
        socket.disconnect();
        return;
      }

      console.log(
        `User connected: ${socket.user.email} (${socket.user.id}) - Socket ID: ${socket.id}`
      );

      // Store user's socket connection
      this.userSockets.set(socket.user.id, socket.id);

      // Let the client know they're connected successfully
      socket.emit("connection_successful", {
        userId: socket.user.id,
        email: socket.user.email,
      });

      // Handle private messages
      socket.on(
        "private_message",
        async (data: { receiverId: string; content: string }) => {
          try {
            console.log(
              `Message from ${socket.user!.id} to ${
                data.receiverId
              }: ${data.content.substring(0, 20)}...`
            );

            // Validate data
            if (!data.receiverId || !data.content) {
              socket.emit("error", {
                message: "Receiver ID and content are required",
              });
              return;
            }

            const message = await prisma.message.create({
              data: {
                content: data.content,
                senderId: socket.user!.id,
                receiverId: data.receiverId,
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                receiver: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            });

            // Send to receiver if online
            const receiverSocketId = this.userSockets.get(data.receiverId);
            if (receiverSocketId) {
              console.log(
                `Sending message to online receiver (socket ${receiverSocketId})`
              );
              this.io.to(receiverSocketId).emit("private_message", message);
            } else {
              console.log(`Receiver ${data.receiverId} is not online`);
            }

            // Send confirmation to sender
            socket.emit("private_message", message);
          } catch (error) {
            console.error("Error sending private message:", error);
            socket.emit("error", { message: "Failed to send message" });
          }
        }
      );

      // Handle get messages request
      socket.on("get_messages", async (data: { userId: string }) => {
        try {
          console.log(
            `Getting messages between ${socket.user!.id} and ${data.userId}`
          );

          if (!data.userId) {
            socket.emit("error", { message: "User ID is required" });
            return;
          }

          const messages = await MessageService.getMessages(
            socket.user!.id,
            data.userId
          );

          console.log(`Found ${messages.length} messages`);
          socket.emit("messages", messages);
        } catch (error) {
          console.error("Error fetching message history:", error);
          socket.emit("error", { message: "Failed to fetch messages" });
        }
      });

      // Group-related events
      socket.on("join_group", async (data: { groupId: string }) => {
        try {
          if (!data.groupId) {
            socket.emit("error", { message: "Group ID is required" });
            return;
          }

          const member = await GroupService.joinGroup(
            data.groupId,
            socket.user!.id
          );

          // Add socket to group room
          socket.join(data.groupId);

          // Store socket in group mapping
          if (!this.groupSockets.has(data.groupId)) {
            this.groupSockets.set(data.groupId, new Set());
          }
          this.groupSockets.get(data.groupId)!.add(socket.id);

          // Notify group members
          this.io.to(data.groupId).emit("group_member_joined", {
            groupId: data.groupId,
            member: member.user,
          });

          // Send group info to the new member
          socket.emit("group_joined", {
            groupId: data.groupId,
            member: member.user,
          });
        } catch (error) {
          console.error("Error joining group:", error);
          socket.emit("error", {
            message:
              error instanceof Error ? error.message : "Failed to join group",
          });
        }
      });

      socket.on("leave_group", async (data: { groupId: string }) => {
        try {
          if (!data.groupId) {
            socket.emit("error", { message: "Group ID is required" });
            return;
          }

          await GroupService.leaveGroup(data.groupId, socket.user!.id);

          // Remove socket from group room
          socket.leave(data.groupId);

          // Remove socket from group mapping
          this.groupSockets.get(data.groupId)?.delete(socket.id);

          // Notify group members
          this.io.to(data.groupId).emit("group_member_left", {
            groupId: data.groupId,
            userId: socket.user!.id,
          });

          // Confirm to the user
          socket.emit("group_left", {
            groupId: data.groupId,
          });
        } catch (error) {
          console.error("Error leaving group:", error);
          socket.emit("error", {
            message:
              error instanceof Error ? error.message : "Failed to leave group",
          });
        }
      });

      socket.on(
        "group_message",
        async (data: { groupId: string; content: string }) => {
          try {
            if (!data.groupId || !data.content) {
              socket.emit("error", {
                message: "Group ID and content are required",
              });
              return;
            }

            console.log(
              `Sending group message to ${
                data.groupId
              }: ${data.content.substring(0, 20)}...`
            );

            const message = await GroupService.sendGroupMessage(
              data.groupId,
              socket.user!.id,
              data.content
            );

            // Send message to all group members
            this.io.to(data.groupId).emit("group_message", message);

            // Send confirmation to sender
            socket.emit("group_message_sent", message);
          } catch (error) {
            console.error("Error sending group message:", error);
            socket.emit("error", {
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to send group message",
            });
          }
        }
      );

      socket.on("get_group_messages", async (data: { groupId: string }) => {
        try {
          if (!data.groupId) {
            socket.emit("error", { message: "Group ID is required" });
            return;
          }

          console.log(`Getting messages for group ${data.groupId}`);
          const messages = await GroupService.getGroupMessages(
            data.groupId,
            socket.user!.id
          );
          console.log(
            `Found ${messages.length} messages for group ${data.groupId}`
          );
          socket.emit("group_messages", messages);
        } catch (error) {
          console.error("Error fetching group messages:", error);
          socket.emit("error", {
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch group messages",
          });
        }
      });

      socket.on("get_user_groups", async () => {
        try {
          const groups = await GroupService.getUserGroups(socket.user!.id);
          socket.emit("user_groups", groups);
        } catch (error) {
          console.error("Error fetching user groups:", error);
          socket.emit("error", { message: "Failed to fetch user groups" });
        }
      });

      // Check connection status periodically
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit("ping", { timestamp: new Date().toISOString() });
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        console.log(
          `User disconnected: ${socket.user!.id} (${
            socket.id
          }) - Reason: ${reason}`
        );

        // Remove user's socket from mappings
        this.userSockets.delete(socket.user!.id);

        // Remove socket from all group mappings
        this.groupSockets.forEach((sockets, groupId) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.groupSockets.delete(groupId);
          }
        });

        clearInterval(pingInterval);
      });
    });
  }
}

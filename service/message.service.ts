import { prisma } from "../server";

export class MessageService {
  static async sendMessage(
    senderId: string,
    receiverId: string,
    content: string
  ) {
    try {
      // Verify receiver exists
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiver) {
        throw new Error("Receiver not found");
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          content,
          senderId,
          receiverId,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return message;
    } catch (error) {
      throw error;
    }
  }

  static async getMessages(userId: string, otherUserId: string) {
    try {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            {
              AND: [{ senderId: userId }, { receiverId: otherUserId }],
            },
            {
              AND: [{ senderId: otherUserId }, { receiverId: userId }],
            },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return messages;
    } catch (error) {
      throw error;
    }
  }
}

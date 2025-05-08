import { prisma } from "../server";

export class GroupService {
  static async createGroup(name: string, creatorId: string) {
    return prisma.group.create({
      data: {
        name,
        members: {
          create: {
            userId: creatorId,
            role: "ADMIN",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  static async getUserGroups(userId: string) {
    return prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  static async joinGroup(groupId: string, userId: string) {
    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (existingMember) {
      throw new Error("Already a member");
    }

    // Add user to group and return the member with user data
    return prisma.groupMember.create({
      data: {
        userId,
        groupId,
        role: "USER",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  static async leaveGroup(groupId: string, userId: string) {
    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: {
            role: "ADMIN",
          },
        },
      },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    // Check if user is a member
    const member = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });

    if (!member) {
      throw new Error("Not a member");
    }

    // Check if user is the last admin
    if (member.role === "ADMIN" && group.members.length === 1) {
      throw new Error("Last admin cannot leave");
    }

    // Remove user from group
    await prisma.groupMember.delete({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
  }

  static async sendGroupMessage(
    groupId: string,
    senderId: string,
    content: string
  ) {
    // Verify sender is a member of the group
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: senderId,
      },
    });

    if (!isMember) {
      throw new Error("You are not a member of this group");
    }

    return prisma.message.create({
      data: {
        content,
        senderId,
        groupId,
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
      },
    });
  }

  static async getGroupMessages(groupId: string, userId: string) {
    // Verify user is a member of the group
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!isMember) {
      throw new Error("You are not a member of this group");
    }

    return prisma.message.findMany({
      where: {
        groupId,
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
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}

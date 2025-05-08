import { Request, Response, NextFunction } from "express";
import { GroupService } from "../service/group.service";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const createGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const group = await GroupService.createGroup(name, userId);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
};

export const getUserGroups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const groups = await GroupService.getUserGroups(userId);
    res.json(groups);
  } catch (error) {
    next(error);
  }
};

export const joinGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    await GroupService.joinGroup(groupId, userId);
    res.json({ message: "Successfully joined the group" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Already a member") {
        return res
          .status(400)
          .json({ message: "Already a member of the group" });
      }
      if (error.message === "Group not found") {
        return res.status(404).json({ message: "Group not found" });
      }
    }
    next(error);
  }
};

export const leaveGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    await GroupService.leaveGroup(groupId, userId);
    res.json({ message: "Successfully left the group" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Last admin cannot leave") {
        return res
          .status(400)
          .json({ message: "Cannot leave the group (last admin)" });
      }
      if (error.message === "Not a member") {
        return res.status(404).json({ message: "Not a member of the group" });
      }
      if (error.message === "Group not found") {
        return res.status(404).json({ message: "Group not found" });
      }
    }
    next(error);
  }
};

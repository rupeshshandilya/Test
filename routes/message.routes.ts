import { Router, Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { body } from "express-validator";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { MessageService } from "../service/message.service";
import { GroupService } from "../service/group.service";
import { apiLimiter } from "../middlewares/rateLimit.middleware";

// Define custom interface for authenticated request
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Apply rate limiter to all message routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/v1/messages:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Send a direct message
 *     description: Send a message to another user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - content
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID of the message receiver
 *               content:
 *                 type: string
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 senderId:
 *                   type: string
 *                 receiverId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Receiver not found
 */
router.post(
  "/",
  [
    body("receiverId").isString().notEmpty(),
    body("content").isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { receiverId, content } = req.body;
      const senderId = req.user!.id;
      const message = await MessageService.sendMessage(
        senderId,
        receiverId,
        content
      );
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/{userId}:
 *   get:
 *     tags:
 *       - Messages
 *     summary: Get messages between two users
 *     description: Retrieve all messages exchanged between the authenticated user and another user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the other user
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   content:
 *                     type: string
 *                   senderId:
 *                     type: string
 *                   receiverId:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get(
  "/:userId",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user!.id;
      const messages = await MessageService.getMessages(currentUserId, userId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/group/{groupId}:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Send a group message
 *     description: Send a message to a group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 senderId:
 *                   type: string
 *                 groupId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input data or not a member of the group
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Group not found
 */
router.post(
  "/group/:groupId",
  [body("content").isString().notEmpty()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const { content } = req.body;
      const senderId = req.user!.id;
      const message = await GroupService.sendGroupMessage(
        groupId,
        senderId,
        content
      );
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/messages/group/{groupId}:
 *   get:
 *     tags:
 *       - Messages
 *     summary: Get group messages
 *     description: Retrieve all messages from a group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   content:
 *                     type: string
 *                   senderId:
 *                     type: string
 *                   groupId:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   sender:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       email:
 *                         type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Group not found or not a member
 */
router.get(
  "/group/:groupId",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;
      const messages = await GroupService.getGroupMessages(groupId, userId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  createGroup,
  getUserGroups,
  joinGroup,
  leaveGroup,
} from "../controllers/group.controller";
import { body } from "express-validator";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { groupLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Apply rate limiter to all group routes
router.use(groupLimiter);

/**
 * @swagger
 * /api/v1/groups:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Create a new group
 *     description: Create a new group with the specified name. The creator becomes an admin of the group.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 description: Name of the group
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                       role:
 *                         type: string
 *                         enum: [USER, ADMIN]
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post(
  "/",
  body("name")
    .isString()
    .isLength({ min: 3 })
    .withMessage("Group name must be at least 3 characters"),
  validateRequest,
  createGroup
);

/**
 * @swagger
 * /api/v1/groups:
 *   get:
 *     tags:
 *       - Groups
 *     summary: Get user's groups
 *     description: Retrieve all groups that the authenticated user is a member of
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   members:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             email:
 *                               type: string
 *                             firstName:
 *                               type: string
 *                             lastName:
 *                               type: string
 *                         role:
 *                           type: string
 *                           enum: [USER, ADMIN]
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get("/", getUserGroups);

/**
 * @swagger
 * /api/v1/groups/{groupId}/join:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Join a group
 *     description: Add the authenticated user as a member of the specified group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group to join
 *     responses:
 *       200:
 *         description: Successfully joined the group
 *       400:
 *         description: Already a member of the group
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Group not found
 */
router.post("/:groupId/join", joinGroup);

/**
 * @swagger
 * /api/v1/groups/{groupId}/leave:
 *   post:
 *     tags:
 *       - Groups
 *     summary: Leave a group
 *     description: Remove the authenticated user from the specified group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group to leave
 *     responses:
 *       200:
 *         description: Successfully left the group
 *       400:
 *         description: Cannot leave the group (last admin)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Group not found or not a member
 */
router.post("/:groupId/leave", leaveGroup);

export default router;

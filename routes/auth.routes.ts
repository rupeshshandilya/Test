import { Router } from "express";
import {
  activationValidation,
  loginValidation,
  resendActivationValidation,
  signupValidation,
} from "../middlewares/validation.middleware";
import {
  activateUser,
  login,
  resendActivationCode,
  signup,
} from "../controllers/auth.controller";
import { authLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// Apply rate limiter to all auth routes
router.use(authLimiter);

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Create a new user account with name, email, country and password. Email verification is required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *               - country
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 description: User's last name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User's password
 *               country:
 *                 type: string
 *                 description: User's country
 *     responses:
 *       201:
 *         description: User registered successfully. Please check your email for verification code.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activationToken:
 *                   type: string
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Email already exists
 */
router.post("/signup", signupValidation, signup);

/**
 * @swagger
 * /api/v1/auth/activate:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Activate user account
 *     description: Activate a user account using the activation code sent to email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activationToken
 *               - activationCode
 *             properties:
 *               activationToken:
 *                 type: string
 *                 description: Token received during signup
 *               activationCode:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 4
 *                 pattern: '^[0-9]+$'
 *                 description: 4-digit activation code sent to email
 *     responses:
 *       200:
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     country:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *       400:
 *         description: Invalid activation code
 *       404:
 *         description: User not found
 */
router.post("/activate", activationValidation, activateUser);

/**
 * @swagger
 * /api/v1/auth/resend-activation:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend activation code
 *     description: Request a new activation code for the user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the unverified user
 *     responses:
 *       200:
 *         description: New activation code sent successfully
 *       404:
 *         description: User not found
 */
router.post(
  "/resend-activation",
  resendActivationValidation,
  resendActivationCode
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate user and return JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [USER, ADMIN]
 *       401:
 *         description: Invalid credentials or unverified account
 *       403:
 *         description: Account not activated
 */
router.post("/login", loginValidation, login);

export default router;

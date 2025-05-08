import { Request, Response, NextFunction } from "express";
import { prisma } from "../server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createActivationToken,
  generateNewActivationCode,
  verifyActivation,
} from "../service/activation.service";
import { validationResult } from "express-validator";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, country } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with isVerified as false
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        country,
        isVerified: false,
      },
    });

    try {
      // Generate activation token and code
      const { token, activationCode } = await createActivationToken({
        firstName,
        lastName,
        email,
        country,
      });

      res.status(201).json({
        message:
          "User created successfully. Please check your email for verification code.",
        activationToken: token,
      });
    } catch (error) {
      // If activation token creation fails, delete the user
      await prisma.user.delete({
        where: { id: user.id },
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("ACTIVATION_TOKEN")) {
        return res.status(500).json({
          message: "Server configuration error. Please contact support.",
        });
      }
    }
    next(error);
  }
};

export const activateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { activationToken, activationCode } = req.body;

    if (!activationToken || !activationCode) {
      return res
        .status(400)
        .json({ message: "Activation token and code are required" });
    }

    try {
      const userData = await verifyActivation(activationToken, activationCode);

      const updatedUser = await prisma.user.update({
        where: {
          email: userData.email,
        },
        data: {
          isVerified: true,
        },
      });

      res.status(200).json({
        message: "User activated successfully",
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          country: updatedUser.country,
          isVerified: updatedUser.isVerified,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Invalid activation code") {
          return res.status(400).json({ message: "Invalid activation code" });
        }
        if (error.message === "User not found") {
          return res.status(404).json({ message: "User not found" });
        }
        if (error.message === "User is already verified") {
          return res.status(400).json({ message: "User is already verified" });
        }
        if (error.message.includes("ACTIVATION_TOKEN")) {
          return res.status(500).json({
            message: "Server configuration error. Please contact support.",
          });
        }
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const resendActivationCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      const { token, activationCode } = await generateNewActivationCode(email);

      res.status(200).json({
        message: 'New activation code sent successfully',
        activationToken: token,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({ message: 'User not found' });
        }
        if (error.message === 'User is already verified') {
          return res.status(400).json({ message: 'User is already verified' });
        }
        if (error.message.includes('ACTIVATION_TOKEN')) {
          return res.status(500).json({ 
            message: 'Server configuration error. Please contact support.' 
          });
        }
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res
        .status(401)
        .json({ message: "Please verify your email first" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error logging in" });
  }
};

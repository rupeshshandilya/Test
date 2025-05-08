import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { sendVerificationEmail } from './email.service';

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
}

interface ActivationPayload {
  user: UserData;
  activationCode: string;
}

export const createActivationToken = async (user: UserData) => {
  if (!process.env.ACTIVATION_TOKEN) {
    throw new Error('ACTIVATION_TOKEN environment variable is not set');
  }

  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_TOKEN,
    {
      expiresIn: "48h",
    }
  );

  // Send activation code via email
  await sendVerificationEmail(user.email, activationCode);

  return { token, activationCode };
};

export const generateNewActivationCode = async (email: string) => {
  if (!process.env.ACTIVATION_TOKEN) {
    throw new Error('ACTIVATION_TOKEN environment variable is not set');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      country: true,
      isVerified: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.isVerified) {
    throw new Error('User is already verified');
  }

  // Generate new activation code and token
  const { token, activationCode } = await createActivationToken({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    country: user.country,
  });

  return { token, activationCode };
};

export const verifyActivation = async (
  activationToken: string,
  activationCode: string
) => {
  if (!process.env.ACTIVATION_TOKEN) {
    throw new Error('ACTIVATION_TOKEN environment variable is not set');
  }

  try {
    const decoded = jwt.verify(
      activationToken,
      process.env.ACTIVATION_TOKEN
    ) as ActivationPayload;

    if (decoded.activationCode !== activationCode) {
      throw new Error('Invalid activation code');
    }

    const user = await prisma.user.findUnique({
      where: {
        email: decoded.user.email,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('User is already verified');
    }

    return decoded.user;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid activation token');
    }
    throw error;
  }
};
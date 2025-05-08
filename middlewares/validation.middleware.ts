import { body } from "express-validator";

export const signupValidation = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),

  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("country").trim().notEmpty().withMessage("Country is required"),
];

export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),

  body("password").trim().notEmpty().withMessage("Password is required"),
];

export const activationValidation = [
  body('activationToken')
    .trim()
    .notEmpty()
    .withMessage('Activation token is required'),
  
  body('activationCode')
    .trim()
    .notEmpty()
    .withMessage('Activation code is required')
    .isLength({ min: 4, max: 4 })
    .withMessage('Activation code must be 4 digits')
    .isNumeric()
    .withMessage('Activation code must contain only numbers'),
];

export const resendActivationValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
];


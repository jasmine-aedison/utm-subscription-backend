const Joi = require('joi');
const { logger } = require('../utils/logger');

// Validation schemas
const schemas = {
  authRequest: Joi.object({
    idToken: Joi.string().required()
  }),

  subscriptionRequest: Joi.object({
    plan: Joi.string().valid('monthly', 'yearly', 'lifetime').required(),
    paymentMethodId: Joi.string().optional()
  }),

  licenseKeyRequest: Joi.object({
    licenseKey: Joi.string().pattern(/^UTM-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/).required()
  }),

  paymentIntentRequest: Joi.object({
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).default('usd')
  }),

  userUpdateRequest: Joi.object({
    displayName: Joi.string().min(1).max(100).optional(),
    photoURL: Joi.string().uri().optional()
  })
};

// Generic validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      logger.warn(`❌ Validation error: ${error.details[0].message}`);
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0].message,
        field: error.details[0].path[0]
      });
    }

    req.body = value; // Use validated and sanitized data
    next();
  };
};

// Specific validation middlewares
const validateAuthRequest = validateRequest(schemas.authRequest);
const validateSubscriptionRequest = validateRequest(schemas.subscriptionRequest);
const validateLicenseKeyRequest = validateRequest(schemas.licenseKeyRequest);
const validatePaymentIntentRequest = validateRequest(schemas.paymentIntentRequest);
const validateUserUpdateRequest = validateRequest(schemas.userUpdateRequest);

// Custom validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateLicenseKey = (licenseKey) => {
  const licenseRegex = /^UTM-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
  return licenseRegex.test(licenseKey);
};

// Sanitization functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return email;
  return email.trim().toLowerCase();
};

module.exports = {
  validateRequest,
  validateAuthRequest,
  validateSubscriptionRequest,
  validateLicenseKeyRequest,
  validatePaymentIntentRequest,
  validateUserUpdateRequest,
  validateEmail,
  validatePassword,
  validateLicenseKey,
  sanitizeString,
  sanitizeEmail,
  schemas
};

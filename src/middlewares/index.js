/**
 * Middleware Index
 * Export all middleware from a single location
 */

const asyncHandler = require("./asyncHandler");
const { authenticate, optionalAuth, authorize } = require("./auth");
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  errorHandler,
  notFoundHandler,
} = require("./errorHandler");
const upload = require("./upload");
const { validate, sanitize, validators, schemas } = require("./validate");

module.exports = {
  // Async Handler
  asyncHandler,

  // Authentication
  authenticate,
  optionalAuth,
  authorize,

  // Error Handling
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  errorHandler,
  notFoundHandler,

  // File Upload
  upload,

  // Validation
  validate,
  sanitize,
  validators,
  schemas,
};


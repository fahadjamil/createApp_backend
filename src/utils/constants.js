/**
 * Application Constants
 * Centralized location for all constant values
 */

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

const MESSAGES = {
  // Success messages
  SUCCESS: {
    CREATED: (resource) => `${resource} created successfully`,
    UPDATED: (resource) => `${resource} updated successfully`,
    DELETED: (resource) => `${resource} deleted successfully`,
    FETCHED: (resource) => `${resource} fetched successfully`,
    LOGIN: "Login successful",
    LOGOUT: "Logout successful",
    SIGNUP: "User signup successful",
    OTP_SENT: (phone) => `OTP sent successfully to ${phone}`,
  },

  // Error messages
  ERROR: {
    NOT_FOUND: (resource) => `${resource} not found`,
    ALREADY_EXISTS: (resource) => `${resource} already exists`,
    REQUIRED: (field) => `${field} is required`,
    INVALID: (field) => `Invalid ${field}`,
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "You don't have permission to perform this action",
    INTERNAL: "Something went wrong. Please try again later.",
    INVALID_CREDENTIALS: "Invalid email or password",
    TOKEN_EXPIRED: "Token has expired",
    TOKEN_INVALID: "Invalid token",
    VALIDATION_FAILED: "Validation failed",
  },
};

const PROJECT_STATUS = {
  DISCUSSION: "Discussion",
  SIGNED: "Signed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
  IN_DISPUTE: "In Dispute",
  PAYMENT_DUE: "Payment Due",
};

const PROTECTED_PROJECT_STATUSES = ["signed", "completed"];

const UPDATABLE_PROJECT_FIELDS = [
  "projectName",
  "projectType",
  "clientName",
  "client",
  "startDate",
  "endDate",
  "description",
  "tags",
  "media",
  "projectStatus",
];

const DELAYED_PROJECT_FIELDS = ["endDate", "projectStatus"];
const DISPUTE_PROJECT_FIELDS = ["tags", "media", "projectStatus"];

const CLIENT_TYPES = ["brand", "individual", "agency", "startup"];

const PAYMENT_STRUCTURES = ["single", "multiple", "recurring"];

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Wallet Transfer",
  "Raast",
  "Payfast",
  "Cash",
];

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD"];

const TOKEN_EXPIRY = "7d";

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

module.exports = {
  HTTP_STATUS,
  MESSAGES,
  PROJECT_STATUS,
  PROTECTED_PROJECT_STATUSES,
  UPDATABLE_PROJECT_FIELDS,
  DELAYED_PROJECT_FIELDS,
  DISPUTE_PROJECT_FIELDS,
  CLIENT_TYPES,
  PAYMENT_STRUCTURES,
  PAYMENT_METHODS,
  CURRENCIES,
  TOKEN_EXPIRY,
  PAGINATION,
};


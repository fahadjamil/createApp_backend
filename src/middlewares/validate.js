const { ValidationError } = require("./errorHandler");

/**
 * Validation Schemas using a simple validation approach
 * (Can be replaced with Joi or express-validator for more complex needs)
 */

const validators = {
  /**
   * Check if value is non-empty string
   */
  required: (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
      return `${fieldName} is required`;
    }
    return null;
  },

  /**
   * Check if value is valid email
   */
  email: (value, fieldName) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return `${fieldName} must be a valid email`;
    }
    return null;
  },

  /**
   * Check if value is valid phone (Pakistan format)
   * Accepts: +92 followed by 10 digits (e.g., +923312344567)
   */
  phone: (value, fieldName) => {
    if (!value) return null;
    // Accept +92 followed by 10 digits (e.g., +923312344567)
    const phoneRegex = /^\+92\d{10}$/;
    if (!phoneRegex.test(value)) {
      return `${fieldName} must be a valid phone number (+92 followed by 10 digits)`;
    }
    return null;
  },

  /**
   * Check minimum length
   */
  minLength: (min) => (value, fieldName) => {
    if (!value) return null;
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  /**
   * Check if value is valid date
   */
  date: (value, fieldName) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  },
};

/**
 * Validation Schemas
 */
const schemas = {
  signup: {
    phone: [validators.required, validators.phone],
    firstName: [validators.required, validators.minLength(2)],
    lastName: [validators.required, validators.minLength(2)],
    email: [validators.required, validators.email],
    password: [validators.required, validators.minLength(6)],
  },

  signin: {
    email: [validators.required, validators.email],
    password: [validators.required],
  },

  createProject: {
    projectName: [validators.required],
    projectType: [validators.required],
    clientName: [validators.required],
    client: [validators.required],
    startDate: [validators.required, validators.date],
    endDate: [validators.required, validators.date],
    userId: [validators.required],
  },

  createClient: {
    fullName: [validators.required],
    clientType: [validators.required],
    phone: [validators.required],
    userId: [validators.required],
  },
};

/**
 * Validation Middleware Factory
 * @param {string} schemaName - Name of schema to validate against
 */
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      console.warn(`Validation schema '${schemaName}' not found`);
      return next();
    }

    const errors = [];

    for (const [field, validatorFns] of Object.entries(schema)) {
      const value = req.body[field];
      
      for (const validatorFn of validatorFns) {
        const error = validatorFn(value, field);
        if (error) {
          errors.push({ field, message: error });
          break; // Stop at first error for this field
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError("Validation failed", errors));
    }

    next();
  };
};

/**
 * Sanitize request body - trim strings and remove undefined values
 */
const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string") {
        req.body[key] = value.trim();
      }
    }
  }
  next();
};

module.exports = {
  validate,
  sanitize,
  validators,
  schemas,
};


/**
 * OAuth utilities module
 */

const response = require('./response');
const validators = require('./validators');

module.exports = {
  // Response formatting
  UserResponse: response.UserResponse,
  createUserResponse: response.createUserResponse,
  ErrorResponse: response.ErrorResponse,
  createErrorResponse: response.createErrorResponse,
  
  // Validators
  isValidEmail: validators.isValidEmail,
  isValidUrl: validators.isValidUrl,
  isValidId: validators.isValidId,
  sanitizeUserData: validators.sanitizeUserData,
  extractAvatar: validators.extractAvatar,
  safeGet: validators.safeGet
};

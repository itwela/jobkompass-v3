/**
 * Input Sanitization and Validation Utilities
 * 
 * Provides centralized input sanitization to protect against:
 * - XSS (Cross-Site Scripting) attacks
 * - NoSQL injection attempts
 * - Malicious script injection
 * - Invalid input patterns
 */

/**
 * Sanitizes a string input by removing potentially dangerous characters
 * and encoding HTML entities to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove control characters except newlines, tabs, and carriage returns
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Encode HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Remove potential NoSQL injection patterns
  sanitized = sanitized.replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, '');
  sanitized = sanitized.replace(/\{\s*\$[a-zA-Z_][a-zA-Z0-9_]*\s*\}/g, '');

  // Remove potential script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

  return sanitized.trim();
}

/**
 * Sanitizes input but preserves HTML for rich text editors
 * Only removes the most dangerous patterns
 */
export function sanitizeRichText(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  let sanitized = input.replace(/\0/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove dangerous event handlers
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove iframe, embed, object tags
  sanitized = sanitized.replace(/<(iframe|embed|object)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  
  return sanitized.trim();
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  // Basic email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = email.trim().toLowerCase();

  if (!emailPattern.test(sanitized)) {
    return '';
  }

  // Remove any potentially dangerous characters while keeping valid email chars
  return sanitized.replace(/[^a-z0-9@._-]/g, '');
}

/**
 * Validates and sanitizes usernames
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') {
    return '';
  }

  // Allow alphanumeric, underscore, hyphen, and dots
  // Length between 3-30 characters
  const sanitized = username.trim().replace(/[^a-zA-Z0-9._-]/g, '');
  
  if (sanitized.length < 3 || sanitized.length > 30) {
    return '';
  }

  return sanitized;
}

/**
 * Validates and sanitizes URLs
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }

  const sanitized = url.trim();
  
  // Remove javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(sanitized)) {
    return '';
  }

  // Basic URL validation
  try {
    const urlObj = new URL(sanitized);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return sanitized;
  } catch {
    // If URL parsing fails, return empty string
    return '';
  }
}

/**
 * Validates input length
 */
export function validateLength(input: string, min: number = 0, max: number = Infinity): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  const length = input.trim().length;
  return length >= min && length <= max;
}

/**
 * Removes excessive whitespace and normalizes spacing
 */
export function normalizeWhitespace(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Type-safe input sanitization based on input type
 */
export type InputType = 'text' | 'email' | 'username' | 'url' | 'richText' | 'textarea';

export function sanitizeByType(input: string, type: InputType = 'text'): string {
  switch (type) {
    case 'email':
      return sanitizeEmail(input);
    case 'username':
      return sanitizeUsername(input);
    case 'url':
      return sanitizeUrl(input);
    case 'richText':
      return sanitizeRichText(input);
    case 'textarea':
      // For textarea, we sanitize but preserve newlines
      return sanitizeInput(input).replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');
    case 'text':
    default:
      return sanitizeInput(input);
  }
}

/**
 * Comprehensive input validation result
 */
export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
}

/**
 * Validates and sanitizes input with comprehensive checks
 */
export function validateAndSanitize(
  input: string,
  options: {
    type?: InputType;
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    pattern?: RegExp;
    customValidator?: (value: string) => boolean;
  } = {}
): ValidationResult {
  const {
    type = 'text',
    minLength = 0,
    maxLength = Infinity,
    required = false,
    pattern,
    customValidator,
  } = options;

  const errors: string[] = [];

  // Check if required
  if (required && (!input || input.trim().length === 0)) {
    errors.push('This field is required');
    return { isValid: false, sanitized: '', errors };
  }

  // Sanitize based on type
  let sanitized = sanitizeByType(input, type);

  // Check length
  if (!validateLength(sanitized, minLength, maxLength)) {
    if (sanitized.length < minLength) {
      errors.push(`Must be at least ${minLength} characters`);
    }
    if (sanitized.length > maxLength) {
      errors.push(`Must be no more than ${maxLength} characters`);
    }
  }

  // Check pattern
  if (pattern && !pattern.test(sanitized)) {
    errors.push('Invalid format');
  }

  // Custom validator
  if (customValidator && !customValidator(sanitized)) {
    errors.push('Validation failed');
  }

  // For email type, check if sanitization removed too much
  if (type === 'email' && sanitized === '' && input.trim() !== '') {
    errors.push('Invalid email address');
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}

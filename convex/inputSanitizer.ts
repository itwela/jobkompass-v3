/**
 * Server-side Input Sanitization for Convex
 * 
 * This is a server-side version of the input sanitizer for use in Convex mutations/queries.
 * Protects against XSS, NoSQL injection, and other security vulnerabilities.
 */

/**
 * Sanitizes a string input by removing potentially dangerous characters
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
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

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

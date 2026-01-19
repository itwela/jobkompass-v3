'use client'

import { useState, useCallback, useRef, useEffect } from 'react';
import { sanitizeByType, validateAndSanitize, type InputType, type ValidationResult } from './inputSanitizer';

export interface UseSanitizedInputOptions {
  type?: InputType;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean;
  sanitizeOnChange?: boolean; // If true, sanitizes on every change. If false, only on blur/submit
  initialValue?: string;
}

export interface UseSanitizedInputReturn {
  value: string;
  sanitizedValue: string;
  setValue: (value: string) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  validation: ValidationResult;
  isValid: boolean;
  errors: string[];
  reset: () => void;
}

/**
 * Hook for managing sanitized input values
 * 
 * @example
 * const { value, onChange, onBlur, isValid, errors } = useSanitizedInput({
 *   type: 'email',
 *   required: true,
 *   minLength: 5,
 * });
 */
export function useSanitizedInput(
  options: UseSanitizedInputOptions = {}
): UseSanitizedInputReturn {
  const {
    type = 'text',
    minLength = 0,
    maxLength = Infinity,
    required = false,
    pattern,
    customValidator,
    sanitizeOnChange = false,
    initialValue = '',
  } = options;

  const [value, setValue] = useState(initialValue);
  const [sanitizedValue, setSanitizedValue] = useState(initialValue);
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: !required || initialValue.trim().length > 0,
    sanitized: initialValue,
    errors: [],
  });

  const validate = useCallback((input: string) => {
    const result = validateAndSanitize(input, {
      type,
      minLength,
      maxLength,
      required,
      pattern,
      customValidator,
    });
    setValidation(result);
    setSanitizedValue(result.sanitized);
    return result;
  }, [type, minLength, maxLength, required, pattern, customValidator]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (sanitizeOnChange) {
      validate(newValue);
    }
  }, [sanitizeOnChange, validate]);

  const handleBlur = useCallback(() => {
    validate(value);
  }, [value, validate]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setSanitizedValue(initialValue);
    validate(initialValue);
  }, [initialValue, validate]);

  // Validate initial value on mount
  useEffect(() => {
    if (initialValue) {
      validate(initialValue);
    }
  }, []); // Only run on mount

  return {
    value,
    sanitizedValue,
    setValue,
    onChange: handleChange,
    onBlur: handleBlur,
    validation,
    isValid: validation.isValid,
    errors: validation.errors,
    reset,
  };
}

/**
 * Simple hook for basic sanitization without validation
 */
export function useSimpleSanitizedInput(
  type: InputType = 'text',
  sanitizeOnChange: boolean = false
) {
  const [value, setValue] = useState('');
  const [sanitizedValue, setSanitizedValue] = useState('');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (sanitizeOnChange) {
      const sanitized = sanitizeByType(newValue, type);
      setSanitizedValue(sanitized);
    } else {
      setSanitizedValue(newValue);
    }
  }, [type, sanitizeOnChange]);

  const handleBlur = useCallback(() => {
    const sanitized = sanitizeByType(value, type);
    setSanitizedValue(sanitized);
  }, [value, type]);

  return {
    value,
    sanitizedValue,
    onChange: handleChange,
    onBlur: handleBlur,
    setValue,
  };
}

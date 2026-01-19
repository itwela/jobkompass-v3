# Input Security System

This project includes a comprehensive input sanitization system to protect against XSS attacks, NoSQL injection, and other security vulnerabilities.

## Overview

All `Input` and `Textarea` components automatically sanitize user input by default. The system:
- ✅ Prevents XSS (Cross-Site Scripting) attacks
- ✅ Protects against NoSQL injection attempts
- ✅ Validates and sanitizes based on input type
- ✅ Works automatically without breaking existing code

## How It Works

### Automatic Sanitization (Default)

By default, all `Input` and `Textarea` components automatically sanitize input:

```tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Automatically sanitizes on blur (default behavior)
<Input type="text" value={value} onChange={handleChange} />
<Textarea value={value} onChange={handleChange} />
```

### Custom Sanitization Types

You can specify the sanitization type:

```tsx
// Email input - automatically validates email format
<Input type="email" sanitize="email" />

// URL input - validates and sanitizes URLs
<Input type="url" sanitize="url" />

// Username input - validates username format
<Input type="text" sanitize="username" />

// Rich text (preserves some HTML)
<Textarea sanitize="richText" />

// Regular textarea (preserves newlines)
<Textarea sanitize="textarea" />
```

### Sanitize on Change vs Blur

By default, sanitization happens on blur to avoid interrupting typing. You can enable real-time sanitization:

```tsx
// Sanitizes on every keystroke (may interrupt typing)
<Input sanitizeOnChange={true} />

// Sanitizes only on blur (default, recommended)
<Input sanitizeOnChange={false} />
```

### Disable Sanitization (Not Recommended)

If you need to disable sanitization for a specific field:

```tsx
<Input sanitize={false} />
<Textarea sanitize={false} />
```

## Using the Hook for Advanced Validation

For more control, use the `useSanitizedInput` hook:

```tsx
import { useSanitizedInput } from "@/lib/useSanitizedInput";

function MyForm() {
  const { 
    value, 
    onChange, 
    onBlur, 
    isValid, 
    errors,
    sanitizedValue 
  } = useSanitizedInput({
    type: 'email',
    required: true,
    minLength: 5,
    maxLength: 100,
  });

  return (
    <div>
      <Input 
        value={value}
        onChange={onChange}
        onBlur={onBlur}
      />
      {!isValid && errors.map(err => <p key={err}>{err}</p>)}
      {/* Use sanitizedValue when submitting */}
    </div>
  );
}
```

## Manual Sanitization

You can also sanitize values manually:

```tsx
import { sanitizeInput, sanitizeEmail, sanitizeByType } from "@/lib/inputSanitizer";

// Basic sanitization
const safe = sanitizeInput(userInput);

// Email sanitization
const safeEmail = sanitizeEmail(userInput);

// Type-based sanitization
const safe = sanitizeByType(userInput, 'email');
```

## Validation

For comprehensive validation:

```tsx
import { validateAndSanitize } from "@/lib/inputSanitizer";

const result = validateAndSanitize(userInput, {
  type: 'email',
  required: true,
  minLength: 5,
  maxLength: 100,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
});

if (result.isValid) {
  // Use result.sanitized
} else {
  // Handle result.errors
}
```

## What Gets Sanitized

The system removes or encodes:
- HTML tags and entities (`<script>`, `onclick=`, etc.)
- JavaScript protocols (`javascript:`, `data:`, etc.)
- NoSQL injection patterns (`$where`, `$ne`, etc.)
- Control characters
- Dangerous event handlers

## Best Practices

1. **Always use the sanitized value** when storing data
2. **Keep sanitization enabled** unless you have a specific reason
3. **Use appropriate types** (email, url, etc.) for better validation
4. **Validate on the server side too** - client-side sanitization is not enough
5. **Use the hook** for complex forms with validation requirements

## Examples

### Email Input
```tsx
<Input 
  type="email" 
  sanitize="email"
  placeholder="your@email.com"
/>
```

### Username Input
```tsx
<Input 
  type="text" 
  sanitize="username"
  placeholder="username"
/>
```

### Chat/Message Input
```tsx
<Textarea 
  sanitize="textarea"
  placeholder="Type your message..."
/>
```

### Rich Text Editor
```tsx
<Textarea 
  sanitize="richText"
  placeholder="Enter formatted text..."
/>
```

## Server-Side Note

While this system protects against client-side attacks, **always validate and sanitize on the server side as well**. Convex mutations should also validate input using the same sanitization functions.

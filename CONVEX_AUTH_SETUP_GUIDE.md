# Convex Auth Setup Guide (Password Provider) for Next.js

This is the **exact, working** setup for Convex Auth with Password provider in a Next.js application. Follow these steps precisely.

---

## Prerequisites

- Next.js 14+ application
- Node.js installed
- Convex account and deployment

---

## Step 1: Install Dependencies

```bash
npm install convex @convex-dev/auth
```

---

## Step 2: Create Convex Configuration Files

### 2.1 Create `convex/convex.config.ts`

```typescript
import { defineApp } from "convex/server";

export default defineApp();
```

### 2.2 Create `convex/auth.config.ts`

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

---

## Step 3: Set Up Authentication in Convex

### 3.1 Create `convex/auth.ts`

This is the **core auth file**. It includes the Password provider and the `currentUser` query.

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    return {
      _id: identity.subject,
      subject: identity.subject,
      name: (user as any)?.name ?? identity.name,
      email: (user as any)?.email ?? identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
```

**Important Notes:**
- `Password` provider is used without calling it as a function
- `currentUser` query uses `getAuthUserId(ctx)` to fetch user from database
- Returns user data including email, name, and identifiers

---

## Step 4: Set Up HTTP Routes

### 4.1 Create `convex/http.ts`

This registers the auth routes with Convex's HTTP router.

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
```

**Critical:** This must be done for auth endpoints to work.

---

## Step 5: Set Up Database Schema

### 5.1 Create or update `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Your custom tables
const myTables = {
  // Example: resources table
  resources: defineTable({
    userId: v.string(),
    type: v.string(),
    category: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_and_category", ["userId", "category"]),
  
  // Add your other tables here
};

const schema = defineSchema({
  ...authTables, // CRITICAL: Include Convex Auth tables
  ...myTables,
});

export default schema;
```

**Important:** `...authTables` must be spread into your schema for auth to work.

---

## Step 6: Create Convex Provider

### 6.1 Create `providers/jkConvexProvider.tsx`

```typescript
'use client';

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function JkConvexProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthNextjsProvider client={convex}>
        {children}
      </ConvexAuthNextjsProvider>
    </ConvexProvider>
  );
}
```

**Important:** Nest `ConvexAuthNextjsProvider` inside `ConvexProvider`.

---

## Step 7: Create Auth Provider (Custom Hook)

### 7.1 Create `providers/jkAuthProvider.tsx`

This provides a centralized auth state to your entire app.

```typescript
'use client'

import { createContext, useContext, ReactNode } from 'react';
import { useConvexAuth } from 'convex/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface User {
  _id: string;
  email?: string;
  name?: string;
  tokenIdentifier: string;
  subject?: string;
}

interface AuthContextType {
  user: User | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function JkAuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.currentUser, isAuthenticated ? {} : "skip");

  const isLoading = convexAuthLoading || (isAuthenticated && user === undefined);

  return (
    <AuthContext.Provider value={{ 
      user,
      isAuthenticated: isAuthenticated && user !== null,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within JkAuthProvider');
  }
  return context;
}
```

**What this does:**
- Uses `useConvexAuth()` for base auth state
- Queries `api.auth.currentUser` to get full user data
- Provides `user`, `isAuthenticated`, and `isLoading` to all components

---

## Step 8: Set Up Root Layout

### 8.1 Update `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { JkConvexProviders } from "@/providers/jkConvexProvider";
import { JkAuthProvider } from "@/providers/jkAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your App Name",
  description: "Your app description",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <JkConvexProviders>
        <JkAuthProvider>
          <html lang="en">
            <body>
              {children}
            </body>
          </html>
        </JkAuthProvider>
      </JkConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
```

**Order matters:**
1. `ConvexAuthNextjsServerProvider` (outermost)
2. `JkConvexProviders`
3. `JkAuthProvider`
4. Your app content

---

## Step 9: Environment Variables

### 9.1 Create `.env.local`

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
```

Get these values from your Convex dashboard or by running:

```bash
npx convex dev
```

---

## Step 10: Using Auth in Components

### 10.1 Sign In/Sign Up Form Example

```typescript
'use client'

import { useState } from 'react';
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/providers/jkAuthProvider";

export default function AuthForm() {
  const { signIn } = useAuthActions();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      await signIn("password", formData);
      // Success - user will be automatically updated via provider
    } catch (error) {
      console.error("Sign in error:", error);
      setAuthError(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setAuthLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated && user) {
    return (
      <div>
        <p>Welcome, {user.email}!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
      />
      <input name="flow" type="hidden" value={signInStep} />
      
      {authError && (
        <div className="error">{authError}</div>
      )}
      
      <button type="submit" disabled={authLoading}>
        {authLoading ? "Please wait..." : signInStep === "signIn" ? "Sign in" : "Sign up"}
      </button>

      <button
        type="button"
        onClick={() => setSignInStep(signInStep === "signIn" ? "signUp" : "signIn")}
      >
        {signInStep === "signIn" ? "Create account" : "Already have account"}
      </button>
    </form>
  );
}
```

**Key Points:**
- Use `useAuthActions()` from `@convex-dev/auth/react` for `signIn`
- Use `useAuth()` from your custom provider for user state
- Form must include `email`, `password`, and hidden `flow` field
- `flow` field must be either `"signIn"` or `"signUp"`

### 10.2 Protected Component Example

```typescript
'use client'

import { useAuth } from "@/providers/jkAuthProvider";

export default function ProtectedComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please sign in to view this content.</div>;
  }

  return (
    <div>
      <h1>Protected Content</h1>
      <p>Hello, {user?.email}!</p>
    </div>
  );
}
```

### 10.3 Using Auth in Convex Mutations/Queries

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Example mutation that requires auth
export const createResource = mutation({
  args: {
    title: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("resources", {
      userId: identity.tokenIdentifier,
      title: args.title,
      url: args.url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Example query that returns user-specific data
export const listResources = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null; // or return []

    return await ctx.db
      .query("resources")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();
  },
});
```

**Important:**
- Always check `await ctx.auth.getUserIdentity()` in protected functions
- Use `identity.tokenIdentifier` as the user ID for database records
- Return `null` or throw error if not authenticated

---

## Step 11: Generate Types and Deploy

### 11.1 Generate Convex Types

```bash
npx convex dev
```

This will:
- Generate TypeScript types in `convex/_generated/`
- Push your schema to Convex
- Start watching for changes

### 11.2 For Production

```bash
npx convex deploy
```

---

## Common Issues and Solutions

### Issue 1: "Property 'currentUser' does not exist on type..."

**Solution:** Run `npx convex dev` to regenerate the API types.

### Issue 2: Auth not working / User always null

**Checklist:**
1. Is `...authTables` in your schema?
2. Is `auth.addHttpRoutes(http)` in `convex/http.ts`?
3. Are providers nested correctly in `layout.tsx`?
4. Did you run `npx convex dev` after adding `currentUser` query?

### Issue 3: Sign in form not working

**Checklist:**
1. Form must have `name="email"` and `name="password"` fields
2. Form must have `name="flow"` hidden field with value `"signIn"` or `"signUp"`
3. Must use `signIn("password", formData)` not `signIn("Password", formData)`

### Issue 4: Resources/data returning undefined

**Solution:** Check that queries use `isAuthenticated ? {} : "skip"` pattern:

```typescript
const data = useQuery(api.yourModule.yourQuery, isAuthenticated ? {} : "skip");
```

---

## File Structure Summary

```
your-project/
├── app/
│   ├── layout.tsx                 # Root layout with providers
│   └── ...
├── convex/
│   ├── _generated/                # Auto-generated (don't edit)
│   ├── auth.config.ts             # Auth configuration
│   ├── auth.ts                    # Auth setup + currentUser query
│   ├── convex.config.ts           # Convex app config
│   ├── http.ts                    # HTTP routes (includes auth routes)
│   ├── schema.ts                  # Database schema with authTables
│   └── ...your other convex files
├── providers/
│   ├── jkAuthProvider.tsx         # Custom auth context provider
│   └── jkConvexProvider.tsx       # Convex + ConvexAuth providers
├── .env.local                     # Environment variables
└── ...
```

---

## Testing Your Setup

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. In another terminal, start Convex:
   ```bash
   npx convex dev
   ```

3. Open your app and try to sign up with an email and password

4. Check the browser console for auth state logs

5. Verify user email appears in your UI when signed in

---

## Additional Resources

- [Convex Auth Docs](https://docs.convex.dev/auth)
- [Convex Auth GitHub](https://github.com/get-convex/convex-auth)
- [Next.js Docs](https://nextjs.org/docs)

---

## Summary

**The key components are:**

1. **`convex/auth.ts`** - Auth setup with `currentUser` query using `getAuthUserId(ctx)`
2. **`convex/http.ts`** - Register auth HTTP routes
3. **`convex/schema.ts`** - Include `...authTables`
4. **`providers/jkConvexProvider.tsx`** - Wrap with ConvexAuthNextjsProvider
5. **`providers/jkAuthProvider.tsx`** - Custom hook using `api.auth.currentUser`
6. **`app/layout.tsx`** - Proper provider nesting order
7. **Sign in form** - Must include `email`, `password`, and `flow` fields

Follow this guide exactly, and Convex Auth will work perfectly in your Next.js app.


'use client'

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useConvexAuth } from 'convex/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface User {
  _id: string;
  email?: string;
  name?: string;
  username?: string;
  tokenIdentifier: string;
  subject?: string;
}

interface AuthContextType {
  user: User | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AI_ID_STORAGE_KEY = 'jk_ai_identity';

export function JkAuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.currentUser, isAuthenticated ? {} : "skip");

  const isLoading = convexAuthLoading || (isAuthenticated && user === undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (user && user._id) {
      window.localStorage.setItem(AI_ID_STORAGE_KEY, user._id);
    } else if (!isAuthenticated || user === null) {
      window.localStorage.removeItem(AI_ID_STORAGE_KEY);
    }
  }, [user, isAuthenticated]);

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


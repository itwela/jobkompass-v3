'use client'

import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
    _id: string;
    name: string;
    email: string;
    tokenIdentifier: string;
}

interface UserContextType {
    user: User | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {


    return (
        <UserContext.Provider value={{ 
            user: null
         }}>
            {children}
        </UserContext.Provider>
    );
}
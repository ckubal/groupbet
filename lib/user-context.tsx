'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { User } from '@/types';

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  allUsers: User[];
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Default friend group
const DEFAULT_USERS: User[] = [
  { id: 'will', name: 'Will', pin: '1234', createdAt: new Date() },
  { id: 'd/o', name: 'D/O', pin: '2345', createdAt: new Date() },
  { id: 'rosen', name: 'Rosen', pin: '3456', createdAt: new Date() },
  { id: 'charlie', name: 'Charlie', pin: '4567', createdAt: new Date() },
  { id: 'pat', name: 'Pat', pin: '5678', createdAt: new Date() },
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers] = useState<User[]>(DEFAULT_USERS);

  // Load user from cookie on mount
  useEffect(() => {
    const savedUserId = Cookies.get('groupbet-user-id');
    if (savedUserId) {
      const user = allUsers.find(u => u.id === savedUserId);
      if (user) {
        setCurrentUser(user);
      }
    }
  }, [allUsers]);

  // Save user to cookie when changed
  useEffect(() => {
    if (currentUser) {
      Cookies.set('groupbet-user-id', currentUser.id, { expires: 365 });
    } else {
      Cookies.remove('groupbet-user-id');
    }
  }, [currentUser]);

  const switchUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, allUsers, switchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
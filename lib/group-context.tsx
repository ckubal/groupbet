'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { GroupSession } from '@/types/group';

interface GroupContextType {
  groupSession: GroupSession | null;
  setGroupSession: (session: GroupSession | null) => void;
  clearGroupSession: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [groupSession, setGroupSession] = useState<GroupSession | null>(null);

  // Load group session from cookie on mount
  useEffect(() => {
    const savedSession = Cookies.get('groupbet-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setGroupSession(session);
      } catch (error) {
        console.error('Failed to parse group session:', error);
        Cookies.remove('groupbet-session');
      }
    }
  }, []);

  // Save group session to cookie when changed
  useEffect(() => {
    if (groupSession) {
      Cookies.set('groupbet-session', JSON.stringify(groupSession), { expires: 365 });
    } else {
      Cookies.remove('groupbet-session');
    }
  }, [groupSession]);

  const clearGroupSession = () => {
    setGroupSession(null);
    Cookies.remove('groupbet-session');
    Cookies.remove('groupbet-user-id');
  };

  return (
    <GroupContext.Provider value={{ groupSession, setGroupSession, clearGroupSession }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}
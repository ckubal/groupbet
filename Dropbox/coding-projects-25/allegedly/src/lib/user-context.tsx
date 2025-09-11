'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface User {
  id: string;
  name: string;
}

interface UserContextType {
  currentUser: User | null;
  groupId: string;
  groupName: string;
  groupMembers: User[];
  setCurrentUser: (user: User | null) => void;
  requireAuth: (callback: () => void) => void;
}

const GROUP_ID = 'allegedly-nfl-2024';
const GROUP_NAME = 'Allegedly';
const GROUP_MEMBERS: User[] = [
  { id: 'charlie', name: 'Charlie' },
  { id: 'rosen', name: 'Rosen' },
  { id: 'will', name: 'Will' },
  { id: 'do', name: 'D.O.' },
  { id: 'pat', name: 'Pat' },
];

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const pathname = usePathname();

  // Check for valid group URL
  const isValidGroupUrl = pathname.includes(`/group/${GROUP_ID}`);

  useEffect(() => {
    // Try to restore user from localStorage
    const savedUserId = localStorage.getItem('allegedly-user-id');
    const savedUserName = localStorage.getItem('allegedly-user-name');
    
    if (savedUserId && savedUserName) {
      // Verify this is still a valid member
      const validMember = GROUP_MEMBERS.find(m => m.id === savedUserId);
      if (validMember) {
        setCurrentUserState({ id: savedUserId, name: savedUserName });
      }
    }

    // Also check for cookie-based identification
    const cookieUserId = document.cookie
      .split('; ')
      .find(row => row.startsWith('allegedly_user_id='))
      ?.split('=')[1];
      
    if (cookieUserId && !currentUser) {
      const member = GROUP_MEMBERS.find(m => m.id === cookieUserId);
      if (member) {
        setCurrentUserState(member);
      }
    }
  }, []);

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    
    if (user) {
      // Save to localStorage
      localStorage.setItem('allegedly-user-id', user.id);
      localStorage.setItem('allegedly-user-name', user.name);
      
      // Set cookie (30 days)
      document.cookie = `allegedly_user_id=${user.id}; max-age=${30 * 24 * 60 * 60}; path=/`;
    } else {
      // Clear storage
      localStorage.removeItem('allegedly-user-id');
      localStorage.removeItem('allegedly-user-name');
      document.cookie = 'allegedly_user_id=; max-age=0; path=/';
    }
  };

  const requireAuth = (callback: () => void) => {
    if (currentUser) {
      callback();
    } else {
      // Store the action and show auth prompt
      setPendingAction(() => callback);
      setShowAuthPrompt(true);
    }
  };

  return (
    <UserContext.Provider 
      value={{
        currentUser,
        groupId: GROUP_ID,
        groupName: GROUP_NAME,
        groupMembers: GROUP_MEMBERS,
        setCurrentUser,
        requireAuth,
      }}
    >
      {children}
      
      {/* Auth Modal */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Who are you?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select your name to continue with this action
            </p>
            
            <div className="space-y-2">
              {GROUP_MEMBERS.map(member => (
                <button
                  key={member.id}
                  onClick={() => {
                    setCurrentUser(member);
                    setShowAuthPrompt(false);
                    if (pendingAction) {
                      pendingAction();
                      setPendingAction(null);
                    }
                  }}
                  className="w-full text-left px-4 py-2 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {member.name}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                setShowAuthPrompt(false);
                setPendingAction(null);
              }}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
'use client';

import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import { User as UserIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserSelector() {
  const { currentUser, allUsers, switchUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <h2 className="text-xl font-semibold mb-4">Select User</h2>
          <div className="space-y-2">
            {allUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <UserIcon className="w-4 h-4" />
        <span className="font-medium">{currentUser.name}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {allUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  switchUser(user.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between",
                  user.id === currentUser.id && "bg-blue-50"
                )}
              >
                <span>{user.name}</span>
                {user.id === currentUser.id && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
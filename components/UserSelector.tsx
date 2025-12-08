'use client';

import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import { User as UserIcon, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserSelector() {
  const { currentUser, allUsers, switchUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  // If no user selected, show a compact banner at top instead of full-screen modal
  if (!currentUser) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Select Your User</h3>
            <p className="text-xs text-blue-700">Choose who you are to view your bets</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {allUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className="px-3 py-1.5 text-sm rounded-md bg-white border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors font-medium text-blue-900"
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
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors bg-white shadow-sm"
      >
        <UserIcon className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-900">{currentUser.name}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-gray-500 transition-transform",
          isOpen && "transform rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Switch User</p>
            </div>
            <div className="py-1">
              {allUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    switchUser(user.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between",
                    user.id === currentUser.id && "bg-blue-50"
                  )}
                >
                  <span className={cn(
                    "font-medium",
                    user.id === currentUser.id ? "text-blue-900" : "text-gray-900"
                  )}>
                    {user.name}
                  </span>
                  {user.id === currentUser.id && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
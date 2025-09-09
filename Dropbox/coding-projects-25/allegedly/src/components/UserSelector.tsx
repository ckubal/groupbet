import { useState } from 'react';
import { User, Check, ChevronDown } from 'lucide-react';

interface UserSelectorProps {
  currentUserId: string;
  onUserChange: (userId: string) => void;
  users: Array<{ id: string; name: string }>;
}

export default function UserSelector({ currentUserId, onUserChange, users }: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentUser = users.find(user => user.id === currentUserId);

  const handleUserSelect = (userId: string) => {
    onUserChange(userId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md border transition-colors ${
          currentUser ? 'border-gray-200 hover:border-gray-300' : 'border-orange-300 border-2 bg-orange-50'
        }`}
      >
        <User size={16} className={currentUser ? "text-gray-600" : "text-orange-600"} />
        <span className={`font-medium ${currentUser ? "text-gray-900" : "text-orange-700"}`}>
          {currentUser?.name || 'Who are you? 👆'}
        </span>
        <ChevronDown 
          size={16} 
          className={`transition-transform ${currentUser ? "text-gray-600" : "text-orange-600"} ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-full">
            <div className="p-2">
              <div className="text-xs text-gray-500 px-2 py-1 uppercase font-semibold">
                Choose Your User
              </div>
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user.id)}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-between ${
                    user.id === currentUserId ? 'bg-green-50 text-green-700' : 'text-gray-900'
                  }`}
                >
                  <span className="font-medium">{user.name}</span>
                  {user.id === currentUserId && (
                    <Check size={16} className="text-green-600" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="border-t border-gray-200 p-2">
              <div className="text-xs text-gray-500 px-2">
                💡 Your votes will be saved under this name
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
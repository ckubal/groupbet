'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGroup } from '@/lib/group-context';
import { useUser } from '@/lib/user-context';

export default function LandingPage() {
  const router = useRouter();
  const { setGroupSession } = useGroup();
  const { allUsers, setCurrentUser } = useUser();
  
  const [mode, setMode] = useState<'landing' | 'join' | 'create' | 'select-user'>('landing');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPassword, setNewGroupPassword] = useState('');
  
  // Available groups (hardcoded for now, could be fetched from an API later)
  const availableGroups = [
    { id: 'allegedly', name: 'allegedly' },
    // Add more groups here as needed
  ];

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGroup) {
      setError('Please select a group');
      return;
    }
    
    // Check password for selected group
    if (selectedGroup === 'allegedly' && password === 'arjuna') {
      setGroupSession({
        groupId: selectedGroup,
        groupName: selectedGroup,
      });
      setMode('select-user');
      setError('');
    } else {
      setError('Incorrect password for this group');
    }
  };

  const handleSelectUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setGroupSession({
        groupId: selectedGroup,
        groupName: selectedGroup,
        userId: user.id,
      });
      router.push('/');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    // For MVP, just show coming soon
    setError('Creating new groups coming soon! Please join an existing group for now.');
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-light mb-4">groupbet</h1>
            <p className="text-gray-400">nfl betting with friends</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('join')}
              className="w-full py-6 bg-gray-900 hover:bg-gray-800 transition-colors rounded-lg"
            >
              <div className="text-xl font-light">join existing group</div>
              <div className="text-gray-400 text-sm mt-1">enter group password</div>
            </button>

            <button
              onClick={() => setMode('create')}
              className="w-full py-6 bg-gray-900/50 hover:bg-gray-800/50 transition-colors rounded-lg border border-gray-800"
            >
              <div className="text-xl font-light">start new group</div>
              <div className="text-gray-400 text-sm mt-1">create your own betting group</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <button
            onClick={() => { 
              setMode('landing'); 
              setError(''); 
              setSelectedGroup(''); 
              setPassword(''); 
            }}
            className="mb-8 text-gray-400 hover:text-white transition-colors"
          >
            ← back
          </button>

          <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-3xl font-light mb-2">join group</h2>
            <p className="text-gray-400 mb-8">select a group and enter password</p>

            <form onSubmit={handleJoinGroup} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Group
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-300/20"
                >
                  <option value="">select group</option>
                  {availableGroups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="group password"
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-300/20"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-yellow-300 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
              >
                join group
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <button
            onClick={() => { 
              setMode('landing'); 
              setError(''); 
              setNewGroupName(''); 
              setNewGroupPassword(''); 
            }}
            className="mb-8 text-gray-400 hover:text-white transition-colors"
          >
            ← back
          </button>

          <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-3xl font-light mb-2">start new group</h2>
            <p className="text-gray-400 mb-8">create your betting group</p>

            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="group name"
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-300/20"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={newGroupPassword}
                  onChange={(e) => setNewGroupPassword(e.target.value)}
                  placeholder="group password"
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-300/20"
                />
              </div>

              {error && (
                <p className="text-orange-400 text-sm">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-yellow-300/20 text-yellow-300 rounded-lg hover:bg-yellow-300/30 transition-colors font-medium border border-yellow-300/20"
              >
                coming soon
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'select-user') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-light mb-2">who are you?</h2>
            <p className="text-gray-400">select to see your bets</p>
          </div>

          <div className="space-y-3">
            {allUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="w-full p-4 bg-gray-900 hover:bg-gray-800 transition-colors rounded-lg text-left"
              >
                <div className="text-xl">{user.name}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { 
              setMode('landing'); 
              setError(''); 
              setPassword('');
              setSelectedGroup('');
            }}
            className="w-full mt-6 text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            ← back to start
          </button>
        </div>
      </div>
    );
  }

  return null;
}
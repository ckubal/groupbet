'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGroup } from '@/lib/group-context';
import { useUser } from '@/lib/user-context';

export default function LandingPage() {
  const router = useRouter();
  const { setGroupSession } = useGroup();
  const { allUsers, setCurrentUser } = useUser();
  
  const [mode, setMode] = useState<'landing' | 'join' | 'create' | 'add-members' | 'select-user'>('landing');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPassword, setNewGroupPassword] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  
  // Available groups (includes stored custom groups)
  const getAvailableGroups = () => {
    const baseGroups = [
      { id: 'allegedly', name: 'allegedly' },
    ];
    
    try {
      const customGroups = JSON.parse(localStorage.getItem('customGroups') || '[]');
      return [...baseGroups, ...customGroups.map((g: any) => ({ id: g.id, name: g.name }))];
    } catch {
      return baseGroups;
    }
  };
  
  const [availableGroups, setAvailableGroups] = useState(getAvailableGroups());

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGroup) {
      setError('Please select a group');
      return;
    }
    
    // Check password for selected group
    let isValidPassword = false;
    
    if (selectedGroup === 'allegedly' && password === 'arjuna') {
      isValidPassword = true;
    } else {
      // Check custom groups
      try {
        const customGroups = JSON.parse(localStorage.getItem('customGroups') || '[]');
        const group = customGroups.find((g: any) => g.id === selectedGroup);
        if (group && group.password === password) {
          isValidPassword = true;
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    
    if (isValidPassword) {
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
    
    if (!newGroupName.trim()) {
      setError('Please enter a group name');
      return;
    }
    
    if (!newGroupPassword.trim()) {
      setError('Please enter a password');
      return;
    }
    
    if (newGroupPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    
    // Check if group name already exists
    if (availableGroups.some(g => g.name.toLowerCase() === newGroupName.toLowerCase())) {
      setError('A group with this name already exists');
      return;
    }
    
    setError('');
    setMode('add-members');
  };

  const handleFinishGroupCreation = async () => {
    if (newGroupMembers.length === 0) {
      setError('Please add at least one member to the group');
      return;
    }
    
    // For now, we'll store the new group temporarily and proceed
    // In a real app, this would be saved to a database
    const newGroup = {
      id: newGroupName.toLowerCase().replace(/\s+/g, '-'),
      name: newGroupName,
      password: newGroupPassword,
      members: newGroupMembers,
      createdAt: new Date().toISOString()
    };
    
    // Store in localStorage for this session
    const existingGroups = JSON.parse(localStorage.getItem('customGroups') || '[]');
    existingGroups.push(newGroup);
    localStorage.setItem('customGroups', JSON.stringify(existingGroups));
    
    // Update available groups list
    setAvailableGroups(getAvailableGroups());
    
    // Set the session for the new group
    setGroupSession({
      groupId: newGroup.id,
      groupName: newGroup.name,
    });
    
    setMode('select-user');
    setError('');
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-foreground mb-3 tracking-tight">
              groupbet
            </h1>
            <p className="text-foreground-muted text-lg font-medium">
              nfl betting with friends
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            <button
              onClick={() => setMode('join')}
              className="w-full card card-hover p-8 text-left group animate-slide-up border-2"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-foreground mb-3 group-hover:text-success transition-colors">
                    join existing group
                  </div>
                  <div className="text-foreground-muted text-base">
                    enter group password to get started
                  </div>
                </div>
                <div className="text-success opacity-30 group-hover:opacity-100 transition-opacity duration-200 ml-6">
                  <div className="w-12 h-12 flex items-center justify-center text-4xl font-bold">→</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('create')}
              className="w-full card card-hover p-8 text-left group animate-slide-up border-2"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-foreground mb-3 group-hover:text-info transition-colors">
                    start new group
                  </div>
                  <div className="text-foreground-muted text-base">
                    create your own betting group
                  </div>
                </div>
                <div className="text-info opacity-30 group-hover:opacity-100 transition-opacity duration-200 ml-6">
                  <div className="w-12 h-12 flex items-center justify-center text-4xl font-bold">+</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Back Button */}
          <button
            onClick={() => { 
              setMode('landing'); 
              setError(''); 
              setSelectedGroup(''); 
              setPassword(''); 
            }}
            className="flex items-center text-foreground-muted hover:text-foreground transition-colors mb-8 group"
          >
            <svg className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            back
          </button>

          {/* Form Card */}
          <div className="card p-8 animate-scale-in">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">join group</h2>
              <p className="text-foreground-muted">select a group and enter password</p>
            </div>

            <form onSubmit={handleJoinGroup} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-3">
                  Group
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="input-field w-full"
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
                <label className="block text-sm font-medium text-foreground-secondary mb-3">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="group password"
                  className="input-field w-full"
                />
              </div>

              {error && (
                <div className="bg-danger-muted border border-danger rounded-sm p-4">
                  <p className="text-danger text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 text-lg font-semibold"
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Back Button */}
          <button
            onClick={() => { 
              setMode('landing'); 
              setError(''); 
              setNewGroupName(''); 
              setNewGroupPassword(''); 
            }}
            className="flex items-center text-foreground-muted hover:text-foreground transition-colors mb-8 group"
          >
            <svg className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            back
          </button>

          {/* Form Card */}
          <div className="card p-8 animate-scale-in">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">start new group</h2>
              <p className="text-foreground-muted">create your betting group</p>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="group name"
                  className="input-field w-full"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={newGroupPassword}
                  onChange={(e) => setNewGroupPassword(e.target.value)}
                  placeholder="group password"
                  className="input-field w-full"
                />
              </div>

              {error && (
                <div className="bg-danger-muted border border-danger rounded-sm p-4">
                  <p className="text-danger text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 text-lg font-semibold"
              >
                next: add members
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'add-members') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <button
            onClick={() => { 
              setMode('create'); 
              setError(''); 
            }}
            className="mb-8 text-gray-400 hover:text-white transition-colors"
          >
            ← back
          </button>

          <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-3xl font-light mb-2">add members</h2>
            <p className="text-gray-400 mb-8">select who can join "{newGroupName}"</p>

            <div className="space-y-4">
              <div className="space-y-2">
                {allUsers.map(user => (
                  <label key={user.id} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newGroupMembers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewGroupMembers(prev => [...prev, user.id]);
                        } else {
                          setNewGroupMembers(prev => prev.filter(id => id !== user.id));
                        }
                      }}
                      className="rounded border-gray-600 bg-gray-700 text-yellow-600 focus:ring-yellow-500 focus:ring-offset-0"
                    />
                    <span className="text-gray-300">{user.name}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Selected: {newGroupMembers.length} member{newGroupMembers.length !== 1 ? 's' : ''}
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={handleFinishGroupCreation}
                className="w-full py-3 bg-yellow-300 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium mt-6"
              >
                create group
              </button>
            </div>
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
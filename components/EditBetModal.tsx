'use client';

import { useState, useEffect } from 'react';
import { Bet } from '@/types';
import { calculatePayout } from '@/lib/betting-odds';
import { useUser } from '@/lib/user-context';

interface EditBetModalProps {
  bet: Bet | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (betId: string, updates: Partial<Bet>) => Promise<void>;
  onDelete?: (betId: string) => Promise<void>;
}

export default function EditBetModal({ bet, isOpen, onClose, onSave, onDelete }: EditBetModalProps) {
  console.log('🔧 EditBetModal render:', { isOpen, betId: bet?.id });
  
  const { allUsers } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    selection: '',
    odds: '',
    amountPerPerson: '',
    line: '',
    participants: [] as string[],
    placedBy: ''
  });

  useEffect(() => {
    if (bet && isOpen) {
      setFormData({
        selection: bet.selection || '',
        odds: bet.odds?.toString() || '',
        amountPerPerson: bet.amountPerPerson?.toString() || '',
        line: bet.line?.toString() || '',
        participants: bet.participants || [],
        placedBy: bet.placedBy || ''
      });
    }
  }, [bet, isOpen]);

  const handleSave = async () => {
    if (!bet) return;
    
    setIsLoading(true);
    try {
      const updates: Partial<Bet> = {
        selection: formData.selection,
        odds: formData.odds ? parseInt(formData.odds) : undefined,
        amountPerPerson: formData.amountPerPerson ? parseFloat(formData.amountPerPerson) : undefined,
        line: formData.line ? parseFloat(formData.line) : undefined,
        participants: formData.participants,
        placedBy: formData.placedBy,
        totalAmount: formData.participants.length * (parseFloat(formData.amountPerPerson) || 0)
      };

      // Remove undefined values
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof typeof updates] === undefined) {
          delete updates[key as keyof typeof updates];
        }
      });

      await onSave(bet.id, updates);
      onClose();
    } catch (error) {
      console.error('Error saving bet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!bet || !onDelete) return;
    
    setIsLoading(true);
    try {
      await onDelete(bet.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting bet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProjectedPayout = () => {
    const amount = parseFloat(formData.amountPerPerson) || 0;
    const odds = parseInt(formData.odds) || -110;
    if (amount > 0 && odds !== 0) {
      const { totalPayout, profit } = calculatePayout(amount, odds);
      return { totalPayout, profit };
    }
    return { totalPayout: 0, profit: 0 };
  };

  if (!isOpen || !bet) {
    console.log('🚫 EditBetModal early return:', { isOpen, hasBet: !!bet });
    return null;
  }

  const { totalPayout, profit } = calculateProjectedPayout();

  console.log('🎨 EditBetModal rendering full modal UI');
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-75" 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9998 
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 flex items-center justify-center pointer-events-none" 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999 
        }}
      >
        <div 
          className="bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
          style={{ 
            backgroundColor: '#1f2937',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '28rem',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            pointerEvents: 'auto'
          }}
        >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Edit Bet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Bet ID (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Bet ID
            </label>
            <input
              type="text"
              value={bet.id}
              disabled
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-400 text-sm"
            />
          </div>

          {/* Bet Placer */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Bet Placer
            </label>
            <select
              value={formData.placedBy}
              onChange={(e) => setFormData(prev => ({ ...prev, placedBy: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500"
            >
              <option value="">Select who placed this bet</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selection - Hide for parlay bets */}
          {bet.betType !== 'parlay' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Selection
              </label>
              <input
                type="text"
                value={formData.selection}
                onChange={(e) => setFormData(prev => ({ ...prev, selection: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500"
                placeholder="e.g. Patriots -3.5"
              />
            </div>
          )}

          {/* Selection - Read-only for parlay bets */}
          {bet.betType === 'parlay' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Selection
              </label>
              <input
                type="text"
                value={formData.selection}
                disabled
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-400 text-sm"
              />
              <div className="mt-1 text-xs text-gray-400">
                Parlay selection is auto-generated and cannot be edited
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Amount Per Person ($)
            </label>
            <input
              type="number"
              value={formData.amountPerPerson}
              onChange={(e) => setFormData(prev => ({ ...prev, amountPerPerson: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500"
              placeholder="50"
              min="0"
              step="0.5"
            />
          </div>

          {/* Odds */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Odds (American format)
            </label>
            <input
              type="number"
              value={formData.odds}
              onChange={(e) => setFormData(prev => ({ ...prev, odds: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500"
              placeholder="-110"
            />
          </div>

          {/* Line (for spreads/totals) - Not applicable for parlays */}
          {bet.betType !== 'parlay' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Line (optional)
              </label>
              <input
                type="number"
                value={formData.line}
                onChange={(e) => setFormData(prev => ({ ...prev, line: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500"
                placeholder="3.5"
                step="0.5"
              />
            </div>
          )}

          {/* Projected Payout */}
          {formData.amountPerPerson && formData.odds && (
            <div className="bg-gray-700 rounded p-3">
              <div className="text-sm text-gray-300 mb-1">Projected Payout:</div>
              <div className="text-green-400 font-mono">
                ${totalPayout.toFixed(2)} total (${profit.toFixed(2)} profit)
              </div>
            </div>
          )}

          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Current Status
            </label>
            <input
              type="text"
              value={bet.status}
              disabled
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-400 text-sm"
            />
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Participants
            </label>
            <div className="space-y-2">
              {allUsers.map(user => (
                <label key={user.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.participants.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          participants: [...prev.participants, user.id]
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          participants: prev.participants.filter(id => id !== user.id)
                        }));
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-gray-300">{user.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Total Amount: ${(formData.participants.length * (parseFloat(formData.amountPerPerson) || 0)).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          {/* Show delete button only if onDelete prop is provided */}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
              disabled={isLoading}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 flex items-center justify-center" 
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              backgroundColor: 'rgba(0, 0, 0, 0.75)'
            }}
          >
            <div 
              className="absolute inset-0" 
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            />
            <div 
              className="bg-gray-800 rounded-xl p-6 max-w-sm w-full relative"
              style={{
                backgroundColor: '#1f2937',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '24rem',
                width: '90%',
                position: 'relative',
                zIndex: 10002,
                margin: '0 20px'
              }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Confirm Delete</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this bet? This action cannot be undone.
              </p>
              <div className="space-y-2 mb-6 text-sm">
                <div className="text-gray-400">
                  <span className="font-medium">Selection:</span> {bet?.selection}
                </div>
                <div className="text-gray-400">
                  <span className="font-medium">Amount:</span> ${bet?.amountPerPerson} per person
                </div>
                <div className="text-gray-400">
                  <span className="font-medium">Status:</span> {bet?.status}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Deleting...' : 'Delete Bet'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
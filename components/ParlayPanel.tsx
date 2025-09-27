'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, X, RotateCcw } from 'lucide-react';
import { Game } from '@/types';
import { calculateParlayOdds, calculateParlayPayout } from '@/lib/parlay-utils';
import { formatOdds, formatMoney } from '@/lib/utils';
import { useUser } from '@/lib/user-context';

export interface ParlaySelection {
  id: string; // unique identifier for this selection
  gameId: string;
  game: Game;
  betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
  selection: string; // display text like "Jaguars +7.5"
  line?: number;
  odds: number;
}

interface ParlayPanelProps {
  isActive: boolean;
  selections: ParlaySelection[];
  onToggleActive: () => void;
  onRemoveSelection: (selectionId: string) => void;
  onClearAll: () => void;
  onPlaceParlay: (parlayData: {
    weekendId: string;
    parlayLegs: Array<{
      betId: string;
      gameId: string;
      betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
      selection: string;
      line?: number;
      odds: number;
    }>;
    parlayOdds: number;
    totalAmount: number;
    amountPerPerson: number;
    placedBy: string;
    participants: string[];
  }) => void;
}

export default function ParlayPanel({
  isActive,
  selections,
  onToggleActive,
  onRemoveSelection,
  onClearAll,
  onPlaceParlay
}: ParlayPanelProps) {
  const { currentUser, allUsers } = useUser();
  const [isExpanded, setIsExpanded] = useState(false);
  
  console.log('🎰 ParlayPanel render:', { isActive, selectionsCount: selections.length });
  console.log('🎰 ParlayPanel isExpanded state:', isExpanded);
  console.log('🎰 ParlayPanel render conditions check:', {
    'isActive && selections.length > 0 && !isExpanded': isActive && selections.length > 0 && !isExpanded,
    'isActive && isExpanded': isActive && isExpanded,
    '!isActive && selections.length === 0': !isActive && selections.length === 0
  });
  const [totalAmount, setTotalAmount] = useState(100);
  const [participants, setParticipants] = useState<string[]>(allUsers.map(u => u.id));
  const [betPlacer, setBetPlacer] = useState<string>(currentUser?.id || '');
  const [customOdds, setCustomOdds] = useState<number | null>(null);

  const canCreateParlay = selections.length >= 2;
  
  // Calculate automatic parlay odds
  let calculatedParlayOdds = -110;
  if (canCreateParlay) {
    const legOdds = selections.map(selection => selection.odds);
    calculatedParlayOdds = calculateParlayOdds(legOdds);
  }

  // Use custom odds if set, otherwise use calculated odds
  const parlayOdds = customOdds !== null ? customOdds : calculatedParlayOdds;
  const payout = canCreateParlay ? calculateParlayPayout(totalAmount, parlayOdds) : { totalPayout: 0, profit: 0 };

  // Reset custom odds when selections change
  const resetToCalculatedOdds = () => {
    setCustomOdds(null);
  };

  const amountPerPerson = participants.length > 0 ? totalAmount / participants.length : 0;

  const handleToggleExpanded = () => {
    if (isActive) {
      setIsExpanded(!isExpanded);
    } else {
      onToggleActive();
      setIsExpanded(true);
    }
  };

  const handlePlaceParlay = () => {
    if (!canCreateParlay || !currentUser) return;

    console.log('🎯 handlePlaceParlay - Pre-validation data:', {
      selections: selections.length,
      parlayOdds,
      totalAmount,
      amountPerPerson,
      betPlacer,
      participants: participants.length,
      weekendId: selections[0]?.game?.weekendId
    });

    const parlayLegs = selections.map((selection, index) => {
      const leg = {
        betId: `${selection.gameId}-${selection.betType}-${index}`,
        gameId: selection.gameId,
        betType: selection.betType,
        selection: selection.selection,
        odds: selection.odds || -110
      };
      
      // Only include line if it's not undefined
      if ((selection as any).line !== undefined && (selection as any).line !== null) {
        (leg as any).line = (selection as any).line;
      }
      
      return leg;
    });

    const parlayData = {
      weekendId: selections[0].game.weekendId,
      parlayLegs,
      parlayOdds,
      totalAmount,
      amountPerPerson,
      placedBy: betPlacer,
      participants
    };

    console.log('🎯 handlePlaceParlay - Calling onPlaceParlay with:', parlayData);

    onPlaceParlay(parlayData);

    // Reset state after placing bet
    setIsExpanded(false);
    onToggleActive();
  };

  const toggleParticipant = (userId: string) => {
    setParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Show panel when active with selections
  if (isActive && selections.length > 0) {
    console.log('🎰 ParlayPanel: SHOULD RENDER - isActive=true, selections=', selections.length, 'isExpanded=', isExpanded);
    
    return (
      <div 
        className="fixed bottom-0 left-0 right-0" 
        style={{ 
          zIndex: 9999,
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%'
        }}
      >
        {isExpanded ? (
          // Expanded Panel - Show full parlay builder
          <div 
            className="border-t-2 border-blue-500 shadow-2xl max-h-[70vh] overflow-y-auto"
            style={{
              backgroundColor: 'white',
              position: 'relative',
              zIndex: 9999
            }}
          >
            {/* Header */}
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 cursor-pointer hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
              onClick={() => {
                console.log('🎰 ParlayPanel header clicked - collapsing');
                setIsExpanded(false);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-lg">🎰 Building Parlay ({selections.length} legs)</span>
                  <div className="text-sm opacity-90">
                    Parlay Odds: {formatOdds(parlayOdds)} • Potential Payout: ${payout.totalPayout.toFixed(2)}
                  </div>
                </div>
                <ChevronDown className="w-6 h-6" />
              </div>
            </div>

            {/* Parlay Legs */}
            <div 
              className="p-4"
              style={{
                backgroundColor: '#f9fafb'
              }}
            >
              <div className="space-y-3">
                {selections.map((selection, index) => (
                  <div 
                    key={selection.id} 
                    className="rounded-lg border p-3 flex items-center justify-between"
                    style={{
                      backgroundColor: 'white'
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-medium" style={{ color: '#111827' }}>{selection.game.awayTeam} @ {selection.game.homeTeam}</div>
                      <div className="text-sm" style={{ color: '#4b5563' }}>{selection.selection}</div>
                      <div className="text-sm" style={{ color: '#2563eb' }}>{formatOdds(selection.odds)}</div>
                    </div>
                    <button
                      onClick={() => {
                        console.log('🗑️ Removing parlay selection:', selection.id);
                        onRemoveSelection(selection.id);
                      }}
                      className="ml-3 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      style={{ fontSize: '18px', fontWeight: 'bold', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Parlay Details Form */}
            {canCreateParlay && (
              <div 
                className="p-4 border-t space-y-4"
                style={{
                  backgroundColor: 'white'
                }}
              >
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                    Total Amount ($)
                  </label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="5"
                  />
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                    Participants
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {allUsers.map(user => (
                      <label key={user.id} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={participants.includes(user.id)}
                          onChange={() => toggleParticipant(user.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span style={{ color: '#374151' }}>{user.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 text-sm" style={{ color: '#6b7280' }}>
                    ${amountPerPerson.toFixed(2)} per person ({participants.length} participants)
                  </div>
                </div>

                {/* Bet Placer */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                    Bet Placer
                  </label>
                  <select
                    value={betPlacer}
                    onChange={(e) => setBetPlacer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select who placed this bet</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parlay Odds (Editable) */}
                {canCreateParlay && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                      Parlay Odds
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customOdds !== null ? customOdds : calculatedParlayOdds}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || calculatedParlayOdds;
                          setCustomOdds(value);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="-110"
                      />
                      {customOdds !== null && (
                        <button
                          onClick={resetToCalculatedOdds}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="Reset to calculated odds"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: '#6b7280' }}>
                      Calculated: {formatOdds(calculatedParlayOdds)}
                      {customOdds !== null && ' (edited)'}
                    </div>
                  </div>
                )}

                {/* Bet Summary */}
                {canCreateParlay && (
                  <div className="border rounded-lg p-3" style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }}>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between items-center">
                        <span style={{ color: '#374151' }}>Total Amount:</span>
                        <span className="font-medium" style={{ color: '#111827' }}>${totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span style={{ color: '#374151' }}>Parlay Odds:</span>
                        <span className="font-medium" style={{ color: '#111827' }}>
                          {formatOdds(parlayOdds)}
                          {customOdds !== null && <span style={{ color: '#6b7280' }}> (edited)</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: '#d1d5db' }}>
                        <span className="font-medium" style={{ color: '#374151' }}>Potential Payout:</span>
                        <span className="font-bold text-lg" style={{ color: '#059669' }}>${payout.totalPayout.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      console.log('🧹 Clearing all parlay selections');
                      onClearAll();
                    }}
                    className="flex-1 px-4 py-2 rounded-md transition-colors"
                    style={{ 
                      backgroundColor: '#e5e7eb', 
                      color: '#374151' 
                    }}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => {
                      console.log('🎯 Placing parlay with', selections.length, 'legs');
                      handlePlaceParlay();
                    }}
                    disabled={!canCreateParlay || participants.length === 0 || !betPlacer}
                    className="flex-1 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    style={{ 
                      backgroundColor: '#2563eb', 
                      color: 'white' 
                    }}
                  >
                    Place Parlay
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Collapsed Panel - Show detailed summary with actual bets
          <div 
            className="cursor-pointer transition-all duration-200 shadow-lg border-t-2"
            style={{
              background: 'linear-gradient(to right, #2563eb, #7c3aed)',
              borderColor: '#3b82f6',
              color: 'white'
            }}
            onClick={() => {
              console.log('🎰 ParlayPanel collapsed bar clicked - expanding');
              setIsExpanded(true);
            }}
          >
            {/* Header */}
            <div className="p-4 border-b border-blue-400/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-lg">🎰 Building Parlay ({selections.length} legs)</span>
                  <div className="text-sm opacity-90">
                    {canCreateParlay ? `${formatOdds(parlayOdds)} odds • $${payout.totalPayout.toFixed(2)} potential payout` : 'Add more legs to create parlay'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronUp className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Show actual selections in collapsed view */}
            <div className="p-3 space-y-2">
              {selections.map((selection, index) => (
                <div key={selection.id} className="flex items-center justify-between bg-white/10 rounded-lg p-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{selection.game.awayTeam} @ {selection.game.homeTeam}</div>
                    <div className="text-xs opacity-75">{selection.selection}</div>
                  </div>
                  <div className="text-xs font-mono opacity-90">
                    {formatOdds(selection.odds)}
                  </div>
                </div>
              ))}
              
              {/* Add more legs prompt */}
              {selections.length < 10 && (
                <div className="text-center py-2 text-xs opacity-75 border-t border-white/20">
                  Tap any bet above to add more legs
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: show build parlay prompt when not active
  if (!isActive) {
    console.log('🎰 ParlayPanel: Rendering build parlay prompt');
    return (
      <div className="fixed bottom-0 left-0 right-0" style={{ zIndex: 9999 }}>
        <div 
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 cursor-pointer hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
          onClick={onToggleActive}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-semibold">🎰 Build Parlay</span>
            <ChevronUp className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  }

  console.log('🎰 ParlayPanel: Fallback - returning null');
  return null;
}
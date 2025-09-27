'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Game } from '@/types';
import { formatMoney } from '@/lib/utils';
import { useUser } from '@/lib/user-context';

interface BetPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceBet: (betData: {
    gameId: string;
    weekendId: string;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
    odds: number;
    line?: number;
    totalAmount: number;
    amountPerPerson: number;
    placedBy: string;
    participants: string[];
    bettingMode: 'group' | 'head_to_head' | 'parlay';
    sideA?: {
      participants: string[];
      selection: string;
    };
    sideB?: {
      participants: string[];
      selection: string;
    };
  }) => void;
  onStartParlay?: (selection: {
    id: string;
    gameId: string;
    game: Game;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
    line?: number;
    odds: number;
  }) => void;
  game: Game | null;
  betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
  selection: string;
}

export default function BetPopup({ isOpen, onClose, onPlaceBet, onStartParlay, game, betType, selection }: BetPopupProps) {
  const { currentUser, allUsers } = useUser();
  
  console.log('🎪 BetPopup render - isOpen:', isOpen, 'game:', game?.homeTeam, 'vs', game?.awayTeam);
  console.log('🎪 BetPopup - betType:', betType, 'spread:', game?.spread, 'o/u:', game?.overUnder);
  const [participants, setParticipants] = useState<string[]>([]);
  const [betPlacer, setBetPlacer] = useState<string>(currentUser?.id || '');
  const [totalAmount, setTotalAmount] = useState(200);
  const [customOdds, setCustomOdds] = useState<number | null>(null);
  const [customLine, setCustomLine] = useState<number | undefined>(undefined);
  
  // Betting mode
  const [bettingMode, setBettingMode] = useState<'group' | 'head_to_head' | 'parlay'>('group');
  const [sideAParticipants, setSideAParticipants] = useState<string[]>([]);
  const [sideBParticipants, setSideBParticipants] = useState<string[]>([]);

  useEffect(() => {
    // Initialize participants with first 4 users by default
    if (allUsers.length > 0 && participants.length === 0) {
      setParticipants(allUsers.slice(0, 4).map(u => u.id));
    }
  }, [allUsers, participants.length]);

  if (!isOpen || !game) {
    console.log('🚫 BetPopup early return - isOpen:', isOpen, 'game:', !!game);
    return null;
  }

  const participantCount = bettingMode === 'group' 
    ? participants.length 
    : bettingMode === 'head_to_head' 
    ? sideAParticipants.length + sideBParticipants.length
    : 0; // parlay mode
  
  // For head-to-head: totalAmount is the pot, split among winners
  // For group: totalAmount is split among all participants
  const amountPerPerson = bettingMode === 'head_to_head' 
    ? totalAmount // For H2H, show total pot amount
    : bettingMode === 'group' 
    ? (participantCount > 0 ? totalAmount / participantCount : 0)
    : 0; // parlay mode

  const getDefaultOdds = () => {
    // For head-to-head bets, default to +100 (even odds)
    if (bettingMode === 'head_to_head') {
      return 100;
    }
    if (bettingMode === 'parlay') {
      return -110; // Standard parlay odds
    }
    
    switch (betType) {
      case 'spread':
        return game.spreadOdds || -110;
      case 'over_under':
        return game.overUnderOdds || -110;
      case 'moneyline':
        // Check if selection contains home team name
        console.log('🎯 Moneyline odds debug:', {
          selection,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeMoneyline: game.homeMoneyline,
          awayMoneyline: game.awayMoneyline,
          includesHome: selection.includes(game.homeTeam),
          includesAway: selection.includes(game.awayTeam)
        });
        
        if (selection.includes(game.homeTeam)) {
          return game.homeMoneyline || -120;
        } else if (selection.includes(game.awayTeam)) {
          return game.awayMoneyline || 100;
        }
        // Fallback: if neither team name is found exactly, try a partial match
        const homeWords = game.homeTeam.split(' ');
        const awayWords = game.awayTeam.split(' ');
        const isHome = homeWords.some(word => selection.includes(word));
        const isAway = awayWords.some(word => selection.includes(word));
        
        if (isHome) {
          return game.homeMoneyline || -120;
        } else if (isAway) {
          return game.awayMoneyline || 100;
        }
        
        return -110; // Final fallback
      case 'player_prop':
        // Extract player prop odds from the game data
        if (game.playerProps) {
          const prop = game.playerProps.find(p => selection.includes(p.playerName));
          if (prop) {
            return selection.toLowerCase().includes('over') ? prop.overOdds : prop.underOdds;
          }
        }
        return -110;
      default:
        return -110;
    }
  };

  const getDefaultLine = () => {
    if (betType === 'player_prop' && game.playerProps) {
      const prop = game.playerProps.find(p => selection.includes(p.playerName));
      return prop?.line || undefined;
    }
    if (betType === 'spread') {
      return selection.includes(game.homeTeam) ? (game.spread || 0) : -(game.spread || 0);
    }
    if (betType === 'over_under') {
      return game.overUnder || undefined;
    }
    return undefined;
  };

  // Helper function to get the opposite selection for head-to-head bets
  const getOppositeSelection = (originalSelection: string): string => {
    if (betType === 'spread') {
      // For spreads, if original is home team, opposite is away team, and vice versa
      if (originalSelection.includes(game.homeTeam)) {
        return originalSelection.replace(game.homeTeam, game.awayTeam).replace(/[+-]?[\d.]+/, (match) => {
          const num = parseFloat(match);
          return num > 0 ? `-${num}` : `+${Math.abs(num)}`;
        });
      } else {
        return originalSelection.replace(game.awayTeam, game.homeTeam).replace(/[+-]?[\d.]+/, (match) => {
          const num = parseFloat(match);
          return num > 0 ? `-${num}` : `+${Math.abs(num)}`;
        });
      }
    } else if (betType === 'over_under') {
      return originalSelection.toLowerCase().includes('over') 
        ? originalSelection.replace(/over/i, 'Under')
        : originalSelection.replace(/under/i, 'Over');
    } else if (betType === 'moneyline') {
      if (originalSelection.includes(game.homeTeam)) {
        return originalSelection.replace(game.homeTeam, game.awayTeam);
      } else {
        return originalSelection.replace(game.awayTeam, game.homeTeam);
      }
    }
    return originalSelection; // Fallback
  };

  const handlePlaceBet = () => {
    console.log('🎰 handlePlaceBet called with bettingMode:', bettingMode);
    // Handle parlay mode
    if ((bettingMode as string) === 'parlay') {
      console.log('🎯 Parlay mode detected!');
      if (!onStartParlay || !game) {
        console.log('❌ Missing onStartParlay or game:', { onStartParlay: !!onStartParlay, game: !!game });
        return;
      }
      
      // Create parlay selection object
      const parlaySelection = {
        id: `${game.id}-${betType}-${selection}`,
        gameId: game.id,
        game,
        betType,
        selection,
        line: betType === 'moneyline' ? undefined : (customLine !== undefined ? customLine : getDefaultLine()),
        odds: customOdds || getDefaultOdds() || -110
      };
      
      console.log('🎰 Calling onStartParlay with:', parlaySelection);
      onStartParlay(parlaySelection);
      onClose();
      return;
    }

    // Update selection text if custom line is used
    let finalSelection = selection;
    if (betType === 'spread' && customLine !== undefined) {
      // Update spread selection with custom line
      if (selection.includes(game.homeTeam)) {
        const sign = customLine >= 0 ? '+' : '';
        finalSelection = `${game.homeTeam} ${sign}${customLine}`;
      } else if (selection.includes(game.awayTeam)) {
        const sign = customLine >= 0 ? '+' : '';
        finalSelection = `${game.awayTeam} ${sign}${customLine}`;
      }
    } else if (betType === 'over_under' && customLine !== undefined) {
      // Update over/under selection with custom line
      finalSelection = selection.replace(/\d+\.?\d*/, customLine.toString());
    } else if (betType === 'player_prop' && customLine !== undefined) {
      // Update player prop selection with custom line
      finalSelection = selection.replace(/\d+\.?\d*/, customLine.toString());
    }

    const baseData = {
      gameId: game.id,
      weekendId: game.weekendId,
      betType,
      selection: finalSelection,
      odds: customOdds || getDefaultOdds() || -110,
      line: betType === 'moneyline' ? undefined : (customLine !== undefined ? customLine : getDefaultLine()),
      totalAmount,
      // For H2H: amountPerPerson is the stake per side, for group: amount per person
      amountPerPerson: bettingMode === 'head_to_head' ? totalAmount : amountPerPerson,
      placedBy: bettingMode === 'head_to_head' ? (sideAParticipants[0] || 'unknown') : betPlacer,
      participants: bettingMode === 'group' ? participants : [...sideAParticipants, ...sideBParticipants],
      bettingMode,
    };

    if (bettingMode === 'head_to_head') {
      const betData = {
        ...baseData,
        sideA: {
          participants: sideAParticipants,
          selection: finalSelection
        },
        sideB: {
          participants: sideBParticipants,
          selection: getOppositeSelection(finalSelection)
        }
      };
      onPlaceBet(betData);
    } else {
      onPlaceBet(baseData);
    }
    
    onClose();
  };

  const toggleParticipant = (userId: string) => {
    if (participants.includes(userId)) {
      setParticipants(participants.filter(id => id !== userId));
    } else {
      setParticipants([...participants, userId]);
    }
  };

  const toggleSideAParticipant = (userId: string) => {
    // Remove from side B if present
    setSideBParticipants(prev => prev.filter(id => id !== userId));
    
    if (sideAParticipants.includes(userId)) {
      setSideAParticipants(prev => prev.filter(id => id !== userId));
    } else {
      setSideAParticipants(prev => [...prev, userId]);
    }
  };

  const toggleSideBParticipant = (userId: string) => {
    // Remove from side A if present
    setSideAParticipants(prev => prev.filter(id => id !== userId));
    
    if (sideBParticipants.includes(userId)) {
      setSideBParticipants(prev => prev.filter(id => id !== userId));
    } else {
      setSideBParticipants(prev => [...prev, userId]);
    }
  };

  return (
    <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}
      >
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: '0 16px',
          color: 'black'
        }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold" style={{ color: 'black' }}>Place Bet</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bet Summary */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-sm mb-1" style={{ color: '#6b7280' }}>
            {game.awayTeam} @ {game.homeTeam}
          </div>
          <div className="font-semibold text-lg" style={{ color: 'black' }}>{selection}</div>
          <div className="flex gap-4 mt-2">
            {/* Only show line for spread, over/under, and player prop bets */}
            {betType !== 'moneyline' && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6b7280' }}>
                  {betType === 'spread' ? 'Spread:' : 
                   betType === 'over_under' ? 'Total:' : 
                   betType === 'player_prop' ? 'Line:' : 'Line:'}
                </span>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={(() => {
                      if (betType === 'spread') {
                        // For spreads, the home team gets the spread value directly
                        // Away team gets the opposite sign
                        if (selection.includes(game.homeTeam)) {
                          // Home team: use spread as-is
                          const spreadValue = customLine !== undefined ? customLine : (game.spread || 0);
                          return spreadValue > 0 ? `+${spreadValue}` : `${spreadValue}`;
                        } else {
                          // Away team: flip the spread sign
                          const spreadValue = customLine !== undefined ? customLine : -(game.spread || 0);
                          return spreadValue > 0 ? `+${spreadValue}` : `${spreadValue}`;
                        }
                      } else if (betType === 'over_under') {
                        // For over/under, just show the number
                        return customLine !== undefined ? customLine : (game.overUnder || 0);
                      } else if (betType === 'player_prop') {
                        // For player props, show the prop line
                        return customLine !== undefined ? customLine : (getDefaultLine() || 0);
                      }
                      return 0;
                    })()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.+-]/g, '');
                      const numValue = parseFloat(value) || 0;
                      setCustomLine(numValue);
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded-l text-sm"
                  />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = customLine !== undefined ? customLine : (getDefaultLine() || 0);
                        setCustomLine(currentValue + 0.5);
                      }}
                      className="px-1 py-0.5 bg-gray-100 border border-l-0 border-gray-300 rounded-tr text-xs hover:bg-gray-200"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = customLine !== undefined ? customLine : (getDefaultLine() || 0);
                        setCustomLine(currentValue - 0.5);
                      }}
                      className="px-1 py-0.5 bg-gray-100 border border-l-0 border-t-0 border-gray-300 rounded-br text-xs hover:bg-gray-200"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#6b7280' }}>Odds:</span>
              <div className="flex items-center">
                <input
                  type="text"
                  value={(() => {
                    const odds = customOdds || getDefaultOdds() || -110;
                    return odds > 0 ? `+${odds}` : `${odds}`;
                  })()}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9+-]/g, '');
                    const numValue = parseInt(value) || 0;
                    setCustomOdds(numValue);
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-l text-sm"
                />
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = customOdds || getDefaultOdds() || -110;
                      setCustomOdds(currentValue + 5);
                    }}
                    className="px-1 py-0.5 bg-gray-100 border border-l-0 border-gray-300 rounded-tr text-xs hover:bg-gray-200"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = customOdds || getDefaultOdds() || -110;
                      setCustomOdds(currentValue - 5);
                    }}
                    className="px-1 py-0.5 bg-gray-100 border border-l-0 border-t-0 border-gray-300 rounded-br text-xs hover:bg-gray-200"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Betting Mode Toggle */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium mb-3" style={{ color: 'black' }}>Betting Mode</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setBettingMode('group')}
              className={`px-3 py-2 rounded-lg border transition-all ${
                bettingMode === 'group'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
              }`}
            >
              Group Bet
            </button>
            <button
              onClick={() => setBettingMode('head_to_head')}
              className={`px-3 py-2 rounded-lg border transition-all ${
                bettingMode === 'head_to_head'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
              }`}
            >
              Head-to-Head
            </button>
            <button
              onClick={() => setBettingMode('parlay' as any)}
              className={`px-3 py-2 rounded-lg border transition-all ${
                (bettingMode as string) === 'parlay'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'
              }`}
            >
              🎰 Parlay
            </button>
          </div>
        </div>

        {/* Amount Section - Hidden for Parlay Mode */}
        {bettingMode !== 'parlay' && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium mb-3" style={{ color: 'black' }}>Bet Amount</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1" style={{ color: '#6b7280' }}>Total Amount</label>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  step="0.5"
                  min="0.5"
                />
              </div>
            </div>
            <div>
              <label className="text-sm block mb-1" style={{ color: '#6b7280' }}>
                {bettingMode === 'head_to_head' ? 'Pot Amount' : `Per Person (${participantCount} people)`}
              </label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg font-medium">
                {bettingMode === 'head_to_head' ? formatMoney(totalAmount) : formatMoney(amountPerPerson)}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Participants Section - Hidden for Parlay Mode */}
        {bettingMode !== 'parlay' && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium mb-3" style={{ color: 'black' }}>Participants</h3>
          
          {/* Bet Placer - Only for group bets */}
          {bettingMode === 'group' && (
            <div className="mb-3">
              <label className="text-sm block mb-1" style={{ color: '#6b7280' }}>Bet Placer</label>
              <select
                value={betPlacer}
                onChange={(e) => setBetPlacer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {allUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {bettingMode === 'group' && (
            /* Group Betting - Everyone on Same Side */
            <div className="space-y-2">
              {allUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={participants.includes(user.id)}
                      onChange={() => toggleParticipant(user.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span style={{ color: 'black' }}>{user.name}</span>
                  </div>
                  {participants.includes(user.id) && (
                    <span className="text-sm text-gray-600">
                      {formatMoney(amountPerPerson)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          
          {(bettingMode as string) === 'parlay' && (
            /* Parlay Mode - Start Building Parlay */
            <div className="text-center py-8 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-4xl mb-3">🎰</div>
              <h4 className="font-semibold text-purple-800 mb-2">Start Building Your Parlay</h4>
              <p className="text-sm text-purple-600 mb-4">
                This bet will become the first leg of your parlay. You can add more legs after placing this selection.
              </p>
              <div className="text-sm text-purple-700 bg-purple-100 rounded-lg p-3">
                <strong>Selected:</strong> {selection}
              </div>
            </div>
          )}
          
          {bettingMode === 'head_to_head' && (
            /* Head-to-Head Betting - Two Sides */
            <div className="space-y-4">
              {/* Side A */}
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                <div className="font-medium text-blue-800 mb-2">
                  Side A: {(() => {
                    // Show updated selection with custom line if applicable
                    let displaySelection = selection;
                    if (betType === 'spread' && customLine !== undefined) {
                      if (selection.includes(game.homeTeam)) {
                        const sign = customLine >= 0 ? '+' : '';
                        displaySelection = `${game.homeTeam} ${sign}${customLine}`;
                      } else if (selection.includes(game.awayTeam)) {
                        const sign = customLine >= 0 ? '+' : '';
                        displaySelection = `${game.awayTeam} ${sign}${customLine}`;
                      }
                    } else if ((betType === 'over_under' || betType === 'player_prop') && customLine !== undefined) {
                      displaySelection = selection.replace(/\d+\.?\d*/, customLine.toString());
                    }
                    return displaySelection;
                  })()}
                </div>
                <div className="space-y-2">
                  {allUsers.map((user) => (
                    <label
                      key={`sideA-${user.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sideAParticipants.includes(user.id)}
                          onChange={() => toggleSideAParticipant(user.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span style={{ color: 'black' }}>{user.name}</span>
                      </div>
                      {sideAParticipants.includes(user.id) && (
                        <span className="text-sm text-blue-600">
                          {formatMoney(totalAmount / (sideAParticipants.length || 1))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Side B */}
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <div className="font-medium text-red-800 mb-2">
                  Side B: {(() => {
                    // Show updated selection with custom line if applicable
                    let displaySelection = selection;
                    if (betType === 'spread' && customLine !== undefined) {
                      if (selection.includes(game.homeTeam)) {
                        const sign = customLine >= 0 ? '+' : '';
                        displaySelection = `${game.homeTeam} ${sign}${customLine}`;
                      } else if (selection.includes(game.awayTeam)) {
                        const sign = customLine >= 0 ? '+' : '';
                        displaySelection = `${game.awayTeam} ${sign}${customLine}`;
                      }
                    } else if ((betType === 'over_under' || betType === 'player_prop') && customLine !== undefined) {
                      displaySelection = selection.replace(/\d+\.?\d*/, customLine.toString());
                    }
                    return getOppositeSelection(displaySelection);
                  })()}
                </div>
                <div className="space-y-2">
                  {allUsers.map((user) => (
                    <label
                      key={`sideB-${user.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-red-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sideBParticipants.includes(user.id)}
                          onChange={() => toggleSideBParticipant(user.id)}
                          className="w-4 h-4 text-red-600"
                        />
                        <span style={{ color: 'black' }}>{user.name}</span>
                      </div>
                      {sideBParticipants.includes(user.id) && (
                        <span className="text-sm text-red-600">
                          {formatMoney(totalAmount / (sideBParticipants.length || 1))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePlaceBet}
            disabled={
              (bettingMode as string) === 'parlay' ? false :
              (bettingMode === 'group' ? (!betPlacer || participants.length === 0) : 
               (sideAParticipants.length === 0 || sideBParticipants.length === 0))
            }
            className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              (bettingMode as string) === 'parlay' 
                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {(bettingMode as string) === 'parlay' ? '🎰 Start Parlay' : 'Place Bet'}
          </button>
        </div>
      </div>
    </div>
  );
}
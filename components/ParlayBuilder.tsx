'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Bet, Game } from '@/types';
import { calculateParlayOdds, calculateParlayPayout, formatParlayDescription } from '@/lib/parlay-utils';
import { formatOdds, formatMoney } from '@/lib/utils';
import { useUser } from '@/lib/user-context';

interface BettingOption {
  gameId: string;
  game: Game;
  betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
  selection: string;
  line?: number;
  odds: number;
}

interface ParlayBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[]; // Games to create betting options from
  onCreateParlay: (parlayData: {
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

export default function ParlayBuilder({ 
  isOpen, 
  onClose, 
  games, 
  onCreateParlay 
}: ParlayBuilderProps) {
  const { currentUser, allUsers } = useUser();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); // Changed from selectedBets
  const [participants, setParticipants] = useState<string[]>([]);
  const [betPlacer, setBetPlacer] = useState<string>(currentUser?.id || '');
  const [totalAmount, setTotalAmount] = useState(100);
  const [mounted, setMounted] = useState(false);
  
  // Generate betting options from games
  const bettingOptions: BettingOption[] = games.flatMap(game => {
    const options: BettingOption[] = [];
    
    // Spread options
    if (game.spread !== undefined && game.spreadOdds !== undefined) {
      options.push({
        gameId: game.id,
        game,
        betType: 'spread',
        selection: `${game.homeTeam} ${game.spread >= 0 ? '+' : ''}${game.spread}`,
        line: game.spread,
        odds: game.spreadOdds
      });
      options.push({
        gameId: game.id,
        game,
        betType: 'spread',
        selection: `${game.awayTeam} ${-game.spread >= 0 ? '+' : ''}${-game.spread}`,
        line: -game.spread,
        odds: game.spreadOdds
      });
    }
    
    // Over/Under options
    if (game.overUnder !== undefined && game.overUnderOdds !== undefined) {
      options.push({
        gameId: game.id,
        game,
        betType: 'over_under',
        selection: `Over ${game.overUnder}`,
        line: game.overUnder,
        odds: game.overUnderOdds
      });
      options.push({
        gameId: game.id,
        game,
        betType: 'over_under',
        selection: `Under ${game.overUnder}`,
        line: game.overUnder,
        odds: game.overUnderOdds
      });
    }
    
    // Moneyline options
    if (game.homeMoneyline !== undefined) {
      options.push({
        gameId: game.id,
        game,
        betType: 'moneyline',
        selection: `${game.homeTeam} ML`,
        odds: game.homeMoneyline
      });
    }
    if (game.awayMoneyline !== undefined) {
      options.push({
        gameId: game.id,
        game,
        betType: 'moneyline',
        selection: `${game.awayTeam} ML`,
        odds: game.awayMoneyline
      });
    }
    
    // Player props
    if (game.playerProps) {
      game.playerProps.forEach(prop => {
        if (prop.overOdds !== undefined) {
          options.push({
            gameId: game.id,
            game,
            betType: 'player_prop',
            selection: `${prop.playerName} Over ${prop.line} ${prop.propType.replace('_', ' ')}`,
            line: prop.line,
            odds: prop.overOdds
          });
        }
        if (prop.underOdds !== undefined) {
          options.push({
            gameId: game.id,
            game,
            betType: 'player_prop',
            selection: `${prop.playerName} Under ${prop.line} ${prop.propType.replace('_', ' ')}`,
            line: prop.line,
            odds: prop.underOdds
          });
        }
      });
    }
    
    return options;
  });
  
  // Initialize participants with all users by default
  useEffect(() => {
    if (allUsers.length > 0 && participants.length === 0) {
      setParticipants(allUsers.map(u => u.id));
    }
  }, [allUsers, participants.length]);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  console.log('🎯 ParlayBuilder rendering with:', {
    isOpen,
    bettingOptionsCount: bettingOptions.length,
    gamesCount: games.length
  });

  console.log('🎯 ParlayBuilder about to return JSX - modal should be VERY visible with red background!');

  const selectedOptionDetails = selectedOptions
    .map(optionId => bettingOptions.find(o => `${o.gameId}-${o.betType}-${o.selection}` === optionId))
    .filter(Boolean) as BettingOption[];

  const canCreateParlay = selectedOptions.length >= 2;
  
  let parlayOdds = -110;
  let payout = { totalPayout: 0, profit: 0 };
  
  if (canCreateParlay) {
    const legOdds = selectedOptionDetails.map(option => option.odds);
    parlayOdds = calculateParlayOdds(legOdds);
    payout = calculateParlayPayout(totalAmount, parlayOdds);
  }

  const amountPerPerson = participants.length > 0 ? totalAmount / participants.length : 0;

  const toggleOptionSelection = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const toggleParticipant = (userId: string) => {
    setParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateParlay = () => {
    if (!canCreateParlay) return;

    const parlayLegs = selectedOptionDetails.map((option, index) => ({
      betId: `${option.gameId}-${option.betType}-${index}`, // Generate unique bet ID
      gameId: option.gameId,
      betType: option.betType,
      selection: option.selection,
      line: option.line,
      odds: option.odds
    }));

    onCreateParlay({
      weekendId: selectedOptionDetails[0].game.weekendId,
      parlayLegs,
      parlayOdds,
      totalAmount,
      amountPerPerson,
      placedBy: betPlacer,
      participants
    });

    onClose();
  };

  const modalContent = (
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
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        margin: '0 16px',
        color: 'black',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'black' }}>Build Parlay</h2>
            <p className="text-sm text-gray-600 mt-1">Add a parlay bet you made this week</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Available Bets */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium mb-3" style={{ color: 'black' }}>Select Bets for Parlay (minimum 2)</h3>
            <div className="text-sm text-gray-600 mb-3">
              Select any combination of spreads, over/unders, moneylines, or player props to build your parlay
            </div>
            {bettingOptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg mb-2">🎯</div>
                <div className="font-medium mb-1">No Betting Options Available</div>
                <div className="text-sm">
                  No games with betting lines available for parlays.
                </div>
                <div className="text-xs mt-4 text-red-500">
                  DEBUG: bettingOptions.length = {bettingOptions.length}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group options by game */}
                {games.map((game) => {
                  const gameOptions = bettingOptions.filter(option => option.gameId === game.id);
                  if (gameOptions.length === 0) return null;
                  
                  return (
                    <div key={game.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="font-medium mb-2" style={{ color: 'black' }}>
                        {game.awayTeam} @ {game.homeTeam}
                        {game.status === 'final' && game.homeScore !== undefined && game.awayScore !== undefined && (
                          <span className="text-sm text-gray-600 ml-2">
                            Final: {game.awayScore}-{game.homeScore}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {gameOptions.map((option) => {
                          const optionId = `${option.gameId}-${option.betType}-${option.selection}`;
                          return (
                            <label
                              key={optionId}
                              className="flex items-center justify-between p-2 rounded-lg border hover:bg-gray-50 cursor-pointer border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedOptions.includes(optionId)}
                                  onChange={() => toggleOptionSelection(optionId)}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <div>
                                  <div className="font-medium" style={{ color: 'black' }}>{option.selection}</div>
                                  <div className="text-sm text-gray-600 capitalize">
                                    {option.betType.replace('_', ' ')}
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm font-medium" style={{ color: 'black' }}>
                                {formatOdds(option.odds)}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Parlay Summary */}
          {selectedOptionDetails.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium mb-3" style={{ color: 'black' }}>Parlay Summary</h3>
              <div className="space-y-2 mb-4">
                {selectedOptionDetails.map((option, index) => (
                  <div key={`${option.gameId}-${option.betType}-${index}`} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'black' }}>{index + 1}. {option.selection}</span>
                    <span className="text-gray-600">{formatOdds(option.odds)}</span>
                  </div>
                ))}
              </div>
              {canCreateParlay && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Parlay Odds:</span>
                    <span className="font-bold text-blue-600">{formatOdds(parlayOdds)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Section */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium mb-3">Bet Amount</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Total Amount</label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    step="10"
                    min="10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Per Person ({participants.length} people)
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg font-medium">
                  {formatMoney(amountPerPerson)}
                </div>
              </div>
            </div>
            
            {canCreateParlay && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-800">
                  <div>Potential Win: <span className="font-bold">{formatMoney(payout.profit)}</span></div>
                  <div>Total Return: <span className="font-bold">{formatMoney(payout.totalPayout)}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="p-4">
            <h3 className="font-medium mb-3">Participants</h3>
            
            <div className="mb-3">
              <label className="text-sm text-gray-600 block mb-1">Bet Placer</label>
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
                    <span>{user.name}</span>
                  </div>
                  {participants.includes(user.id) && (
                    <span className="text-sm text-gray-600">
                      {formatMoney(amountPerPerson)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateParlay}
            disabled={!canCreateParlay || participants.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create {selectedOptions.length}-Leg Parlay
          </button>
        </div>
      </div>
    </div>
  );

  return modalContent;
}
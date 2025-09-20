'use client';

import React, { useState, useEffect } from 'react';
import { Game, Bet } from '@/types';
import { useUser } from '@/lib/user-context';
import GameCard from '@/components/GameCard';
import BetPopup from '@/components/BetPopup';
import UserSelector from '@/components/UserSelector';
import { format } from 'date-fns';
import { getCurrentNFLWeek } from '@/lib/utils';
import { betService } from '@/lib/firebase-service';
import { calculatePayout, formatOdds } from '@/lib/betting-odds';
import { useRouter, useSearchParams } from 'next/navigation';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface UserBalance {
  won: number;
  lost: number;
  net: number;
}

interface GamesPageProps {
  initialGames: Game[];
  initialWeek?: number;
}

export default function GamesPage({ initialGames, initialWeek }: GamesPageProps) {
  console.log('🎯 GAMES PAGE RENDERING with', initialGames.length, 'games');
  
  const { currentUser, allUsers } = useUser();
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(initialWeek || getCurrentNFLWeek());
  const [games, setGames] = useState<Game[]>(initialGames); // Allow dynamic game updates
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [userBalances, setUserBalances] = useState<Record<string, UserBalance>>({});
  const [showSettlement, setShowSettlement] = useState(false);
  
  // Handle week navigation
  const handleWeekChange = (week: number) => {
    setCurrentWeek(week);
    router.push(`/?week=${week}`);
  };
  
  // Load additional games for bets that aren't found in current week's games
  const loadMissingBetGames = async (bets: Bet[]) => {
    const missingGameIds = bets
      .filter(bet => !games.find(g => g.id === bet.gameId))
      .map(bet => bet.gameId);
    
    if (missingGameIds.length === 0) return;
    
    console.log(`🔍 Loading missing games for ${missingGameIds.length} bets`);
    
    // Extract week numbers from bet weekendIds and load those weeks
    const missingWeeks = new Set(
      bets
        .filter(bet => missingGameIds.includes(bet.gameId))
        .map(bet => parseInt(bet.weekendId.split('-')[2]))
    );
    
    const additionalGames: Game[] = [];
    
    for (const week of missingWeeks) {
      if (week !== currentWeek) {
        try {
          console.log(`📅 Loading Week ${week} games for missing bets`);
          const response = await fetch(`/api/games?week=${week}`);
          if (response.ok) {
            const weekGames = await response.json();
            additionalGames.push(...weekGames);
            console.log(`✅ Loaded ${weekGames.length} games from Week ${week}`);
          }
        } catch (error) {
          console.error(`❌ Failed to load Week ${week} games:`, error);
        }
      }
    }
    
    if (additionalGames.length > 0) {
      setGames(prevGames => {
        // Merge games, avoiding duplicates
        const existingIds = new Set(prevGames.map(g => g.id));
        const newGames = additionalGames.filter(g => !existingIds.has(g.id));
        console.log(`🔄 Adding ${newGames.length} additional games to game list`);
        return [...prevGames, ...newGames];
      });
    }
  };
  
  // Fetch user bets and settlement data when user changes
  useEffect(() => {
    const fetchUserBets = async () => {
      if (!currentUser) {
        setUserBets([]);
        return;
      }
      
      try {
        setIsLoadingBets(true);
        
        // First, get bets for current week being viewed
        const weekendId = `2025-week-${currentWeek}`;
        const currentWeekBets = await betService.getBetsForUser(currentUser.id, weekendId);
        
        // Also get bets from adjacent weeks (common scenario)
        const allBets: Bet[] = [...currentWeekBets];
        
        // Check a few adjacent weeks for additional bets
        const weeksToCheck = [currentWeek - 1, currentWeek + 1, 2]; // Always check week 2 since it has most bets
        
        for (const week of weeksToCheck) {
          if (week >= 1 && week <= 18 && week !== currentWeek) {
            try {
              const weekendId = `2025-week-${week}`;
              const weekBets = await betService.getBetsForUser(currentUser.id, weekendId);
              allBets.push(...weekBets);
            } catch (error) {
              // Ignore errors for weeks with no bets
              console.log(`No bets found for Week ${week}`);
            }
          }
        }
        
        setUserBets(allBets);
        console.log(`✅ Loaded ${allBets.length} total bets for user ${currentUser.name} across all weeks`);
        
        // Load games for any bets that aren't in the current week's game list
        await loadMissingBetGames(allBets);
        
      } catch (error) {
        console.error('❌ Failed to fetch user bets:', error);
        setUserBets([]);
      } finally {
        setIsLoadingBets(false);
      }
    };
    
    const fetchSettlement = async () => {
      try {
        const weekendId = `2025-week-${currentWeek}`;
        const response = await fetch(`/api/weekly-settlement?weekendId=${weekendId}`);
        const data = await response.json();
        
        if (data.success) {
          setSettlements(data.settlements);
          setUserBalances(data.userBalances);
          console.log(`💰 Loaded settlement data: ${data.settlements.length} transactions`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch settlement:', error);
      }
    };
    
    fetchUserBets();
    fetchSettlement();
  }, [currentUser, currentWeek]);
  const [selectedBet, setSelectedBet] = useState<{
    game: Game | null;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
  } | null>(null);
  const [isBetPopupOpen, setIsBetPopupOpen] = useState(false);
  // Auto-collapse sections where all games are final
  const getDefaultCollapsedSections = () => {
    const collapsed = new Set<string>();
    const gamesByTimeSlot = games.reduce((acc, game) => {
      const slot = game.timeSlot;
      if (!acc[slot]) acc[slot] = [];
      acc[slot].push(game);
      return acc;
    }, {} as Record<string, Game[]>);
    
    // Collapse sections where all games are final
    Object.entries(gamesByTimeSlot).forEach(([slot, slotGames]) => {
      if (slotGames.every(game => game.status === 'final')) {
        collapsed.add(slot);
      }
    });
    
    return collapsed;
  };
  
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(getDefaultCollapsedSections());

  // Group games by time slot for display
  const gamesByTimeSlot = games.reduce((acc, game) => {
    const slot = game.timeSlot;
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  // Sort games within each time slot by game time
  Object.keys(gamesByTimeSlot).forEach(slot => {
    gamesByTimeSlot[slot].sort((a, b) => 
      new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
    );
  });

  console.log('🎮 UI RENDERING - Games by time slot:', Object.keys(gamesByTimeSlot).map(slot => `${slot}: ${gamesByTimeSlot[slot].length}`));

  const timeSlots = [
    { key: 'thursday', title: 'Thursday Night Football', games: gamesByTimeSlot.thursday || [] },
    { key: 'sunday_early', title: 'Sunday Early Games', games: gamesByTimeSlot.sunday_early || [] },
    { key: 'sunday_afternoon', title: 'Sunday Afternoon Games', games: gamesByTimeSlot.sunday_afternoon || [] },
    { key: 'sunday_night', title: 'Sunday Night Football', games: gamesByTimeSlot.sunday_night || [] },
    { key: 'monday', title: 'Monday Night Football', games: gamesByTimeSlot.monday || [] },
  ];

  const totalGames = games.length;
  const completedGames = games.filter(g => g.status === 'final').length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            GroupBet
          </h1>
          {/* Week Navigation */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <button
              onClick={() => handleWeekChange(Math.max(1, currentWeek - 1))}
              disabled={currentWeek <= 1}
              className={`p-2 rounded-full transition-colors ${
                currentWeek <= 1 
                  ? 'text-gray-500 cursor-not-allowed' 
                  : 'text-blue-200 hover:text-white hover:bg-white/20'
              }`}
            >
              ← 
            </button>
            
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">
                NFL Week {currentWeek}
              </h2>
              <p className="text-blue-200 text-sm">
                {completedGames}/{totalGames} Games Complete
              </p>
            </div>
            
            <button
              onClick={() => handleWeekChange(Math.min(18, currentWeek + 1))}
              disabled={currentWeek >= 18}
              className={`p-2 rounded-full transition-colors ${
                currentWeek >= 18 
                  ? 'text-gray-500 cursor-not-allowed' 
                  : 'text-blue-200 hover:text-white hover:bg-white/20'
              }`}
            >
              →
            </button>
          </div>
        </div>

        {/* User Selection */}
        <div className="mb-8">
          <UserSelector />
        </div>

        {currentUser ? (
          <div className="space-y-8">
            {/* Betting Summary Section */}
            {userBets.length > 0 && (() => {
              let totalStaked = 0;
              let totalPayout = 0;
              let wonBets = 0;
              let lostBets = 0;
              let activeBets = 0;
              
              userBets.forEach(bet => {
                totalStaked += bet.amountPerPerson;
                if (bet.status === 'won') {
                  const { totalPayout: betPayout } = calculatePayout(bet.amountPerPerson, bet.odds);
                  totalPayout += betPayout;
                  wonBets++;
                } else if (bet.status === 'lost') {
                  lostBets++;
                } else {
                  activeBets++;
                }
              });
              
              const netProfit = totalPayout - totalStaked;
              const netColor = netProfit > 0 ? 'text-green-400' : netProfit < 0 ? 'text-red-400' : 'text-gray-300';
              
              return (
                <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
                  <div className="flex flex-wrap items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">
                      Week {currentWeek} Summary • {userBets.length} Bets
                    </h2>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="text-gray-300">Total Staked</div>
                        <div className="text-white font-semibold">${totalStaked.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-300">Total Payout</div>
                        <div className="text-white font-semibold">${totalPayout.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-300">Net P&L</div>
                        <div className={`font-bold text-lg ${netColor}`}>
                          {netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-300">Record</div>
                        <div className="text-white font-semibold">
                          {wonBets}W-{lostBets}L
                          {activeBets > 0 && `-${activeBets}P`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Weekly Settlement Section - Aesthetic Design */}
            {settlements.length > 0 && (
              <div className="bg-black/30 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-light text-white mb-1">
                      weekly settlement
                    </h2>
                    <div className="text-sm text-gray-400 font-mono">
                      week {currentWeek} • {settlements.length} transaction{settlements.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSettlement(!showSettlement)}
                    className="text-gray-400 hover:text-yellow-300 transition-all duration-300 text-sm font-mono tracking-wide"
                  >
                    {showSettlement ? '[ hide ]' : '[ show ]'}
                  </button>
                </div>
                
                {showSettlement && (
                  <div className="space-y-6">
                    {settlements.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 font-light text-lg">
                        everyone is even
                      </div>
                    ) : (
                      settlements.map((settlement, index) => (
                        <div key={index} className="group">
                          <div className="flex items-baseline space-x-3 py-3 border-b border-gray-700/30 hover:border-yellow-300/30 transition-all duration-300">
                            <span className="text-yellow-300 font-medium text-lg">{settlement.from}</span>
                            <span className="text-gray-400 font-light">owes</span>
                            <span className="text-yellow-300 font-medium text-lg">{settlement.to}</span>
                            <div className="flex-1"></div>
                            <span className="text-white font-mono text-xl group-hover:text-yellow-300 transition-colors duration-300">
                              ${settlement.amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Bets Section */}
            {userBets.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
                <h2 className="text-xl font-bold text-white mb-4">
                  Your Bets ({userBets.length})
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {userBets.map(bet => {
                    const game = games.find(g => g.id === bet.gameId);
                    
                    // Calculate win/loss amount and payout using actual betting odds
                    let betResult = '';
                    let resultColor = 'text-gray-300';
                    let resultIcon = '';
                    
                    if (bet.status === 'won') {
                      const { profit } = calculatePayout(bet.amountPerPerson, bet.odds);
                      betResult = `+$${profit.toFixed(2)}`;
                      resultColor = 'text-green-400';
                      resultIcon = '✓';
                    } else if (bet.status === 'lost') {
                      betResult = `-$${bet.amountPerPerson.toFixed(2)}`;
                      resultColor = 'text-red-400';
                      resultIcon = '✗';
                    } else {
                      betResult = `${formatOdds(bet.odds)}`;
                      resultColor = 'text-yellow-300';
                      resultIcon = '⏳';
                    }
                    
                    return (
                      <div key={bet.id} 
                           style={{ 
                             width: 'calc(25% - 9px)', 
                             minWidth: '200px',
                             minHeight: '120px'
                           }}
                           className={`bg-white/20 rounded-lg p-3 border transition-all hover:bg-white/25 ${
                        bet.status === 'won' ? 'border-green-400/50' : 
                        bet.status === 'lost' ? 'border-red-400/50' : 
                        'border-white/30'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-col">
                            <div className="text-white font-medium text-sm leading-tight">
                              {game ? `${game.awayTeam.split(' ').pop()} @ ${game.homeTeam.split(' ').pop()}` : 'Game Not Found'}
                            </div>
                            <div className="text-xs text-blue-300 mt-0.5">
                              by {bet.placedBy}
                            </div>
                          </div>
                          <div className={`${resultColor} text-sm font-bold flex items-center`}>
                            <span className="mr-1">{resultIcon}</span>
                            {betResult}
                          </div>
                        </div>
                        
                        <div className="text-blue-200 text-xs mb-1">
                          {bet.betType.replace('_', ' ').toUpperCase()}: {bet.selection}
                        </div>
                        
                        <div className="text-gray-300 text-xs">
                          ${bet.amountPerPerson.toFixed(0)} stake
                        </div>
                        
                        {game && game.status === 'final' && (
                          <div className="text-yellow-300 text-xs mt-1">
                            {bet.betType === 'player_prop' && bet.result ? 
                              bet.result : 
                              `${game.awayTeam.split(' ').pop()} ${game.awayScore} - ${game.homeTeam.split(' ').pop()} ${game.homeScore}`
                            }
                          </div>
                        )}
                        
                        {!game && (
                          <div className="text-orange-300 text-xs mt-1">
                            ⚠️ Missing data
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Games by Time Slot */}
            {timeSlots.map(timeSlot => {
              if (timeSlot.games.length === 0) return null;
              
              const isCollapsed = collapsedSections.has(timeSlot.key);
              
              return (
                <div key={timeSlot.key} className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
                  <button
                    onClick={() => {
                      const newCollapsed = new Set(collapsedSections);
                      if (isCollapsed) {
                        newCollapsed.delete(timeSlot.key);
                      } else {
                        newCollapsed.add(timeSlot.key);
                      }
                      setCollapsedSections(newCollapsed);
                    }}
                    className="w-full px-6 py-4 text-left text-white font-semibold text-lg hover:bg-white/5 transition-colors flex justify-between items-center"
                  >
                    <span>{timeSlot.title} ({timeSlot.games.length})</span>
                    <span className="transform transition-transform">
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="px-6 pb-6">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {timeSlot.games.map(game => (
                          <GameCard
                            key={game.id}
                            game={game}
                            userBets={userBets}
                            onBetClick={(game, betType, selection) => {
                              setSelectedBet({ game, betType, selection });
                              setIsBetPopupOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {totalGames === 0 && (
              <div className="text-center py-12">
                <p className="text-white text-xl">No games found for this week.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white text-xl">Please select a user to view games and place bets.</p>
          </div>
        )}
      </div>

      {/* Bet Popup */}
      <BetPopup
        isOpen={isBetPopupOpen}
        onClose={() => setIsBetPopupOpen(false)}
        game={selectedBet?.game || null}
        betType={selectedBet?.betType || 'spread'}
        selection={selectedBet?.selection || ''}
        onPlaceBet={async (betData) => {
          try {
            await betService.createBet(betData);
            setIsBetPopupOpen(false);
            // Refresh user bets when a new bet is placed
            if (currentUser) {
              const weekendId = `2025-week-${currentWeek}`;
              const bets = await betService.getBetsForUser(currentUser.id, weekendId);
              setUserBets(bets);
            }
          } catch (error) {
            console.error('❌ Failed to place bet:', error);
          }
        }}
      />
    </div>
  );
}
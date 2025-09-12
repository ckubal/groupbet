'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import BetPlacer from '@/components/BetPlacer';
import ActualBetsTracker, { ActualBet } from '@/components/ActualBetsTracker';
import TabLayout from '@/components/TabLayout';
import { Target, DollarSign, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

interface PlacedBet {
  id: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: string;
  description: string;
  amount: number;
  odds: number;
  betPlacer: string;
  participants: string[];
  isPlaced: boolean;
  createdAt: Date;
}

const friendGroup = [
  { id: 'charlie', name: 'Charlie' },
  { id: 'rosen', name: 'Rosen' },
  { id: 'will', name: 'Will' },
  { id: 'do', name: 'D.O.' },
  { id: 'pat', name: 'Pat' },
];

export default function ConsensusPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selections, setSelections] = useState<UserSelection[]>([]);
  const [actualBets, setActualBets] = useState<ActualBet[]>([]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load games
        const apiGames = await oddsApi.getNFLGames();
        if (apiGames && apiGames.length > 0) {
          const transformedGames = apiGames
            .map(apiGame => {
              try {
                return oddsApi.transformApiGameToGame(apiGame);
              } catch (error) {
                console.warn('Failed to transform game:', apiGame.id, error);
                return null;
              }
            })
            .filter((game): game is NonNullable<typeof game> => game !== null);

          if (transformedGames.length > 0) {
            setGames(transformedGames);
          } else {
            throw new Error('No valid games after transformation');
          }
        } else {
          throw new Error('No games returned from API');
        }
      } catch (error) {
        console.warn('Failed to load from The Odds API, using mock data:', error);
        setGames(getMockNFLGames());
      } finally {
        // Load saved data
        const cachedUserId = localStorage.getItem('allegedly-user-id');
        if (cachedUserId) {
          setCurrentUserId(cachedUserId);
        }

        const savedSelections = localStorage.getItem('allegedly-selections');
        if (savedSelections) {
          setSelections(JSON.parse(savedSelections));
        }

        const savedBets = localStorage.getItem('allegedly-actual-bets');
        if (savedBets) {
          setActualBets(JSON.parse(savedBets));
        }

        const savedPlacedBets = localStorage.getItem('allegedly-placed-bets');
        if (savedPlacedBets) {
          setPlacedBets(JSON.parse(savedPlacedBets));
        }

        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Save actual bets to localStorage
  useEffect(() => {
    if (actualBets.length > 0) {
      localStorage.setItem('allegedly-actual-bets', JSON.stringify(actualBets));
    }
  }, [actualBets]);

  // Save placed bets to localStorage
  useEffect(() => {
    if (placedBets.length > 0) {
      localStorage.setItem('allegedly-placed-bets', JSON.stringify(placedBets));
    }
  }, [placedBets]);

  const handleAddActualBet = (betData: Omit<ActualBet, 'id' | 'createdAt'>) => {
    const newBet: ActualBet = {
      ...betData,
      id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };
    
    setActualBets(prev => [...prev, newBet]);
  };

  const handleUpdateActualBet = (betId: string, updates: Partial<ActualBet>) => {
    setActualBets(prev => prev.map(bet => 
      bet.id === betId ? { ...bet, ...updates } : bet
    ));
  };

  const handleDeleteActualBet = (betId: string) => {
    setActualBets(prev => prev.filter(bet => bet.id !== betId));
  };

  const handlePlaceBet = (betData: Omit<PlacedBet, 'id' | 'createdAt'>) => {
    const newBet: PlacedBet = {
      ...betData,
      id: `placed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };
    
    setPlacedBets(prev => [...prev, newBet]);
  };

  const handleUpdatePlacedBet = (betId: string, updates: Partial<PlacedBet>) => {
    setPlacedBets(prev => prev.map(bet => 
      bet.id === betId ? { ...bet, ...updates } : bet
    ));
  };

  const handleDeletePlacedBet = (betId: string) => {
    setPlacedBets(prev => prev.filter(bet => bet.id !== betId));
  };

  // Calculate weekly stats
  const getWeeklyStats = () => {
    const totalBetsFromConsensus = placedBets.length;
    const totalAmountFromConsensus = placedBets.reduce((sum, bet) => sum + bet.amount, 0);
    
    const actualBetsThisWeek = actualBets.filter(bet => {
      // Filter for current week - you might want to adjust this logic based on your week definition
      const betDate = new Date(bet.createdAt);
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      return betDate >= weekStart;
    });

    const totalActualBets = actualBetsThisWeek.length;
    const totalActualAmount = actualBetsThisWeek.reduce((sum, bet) => {
      if (bet.type === 'head_to_head' && bet.h2h) {
        return sum + bet.h2h.amount;
      }
      return sum + (bet.betDetails?.amount || 0);
    }, 0);

    // Calculate winnings/losses for settled bets
    const settledBets = actualBetsThisWeek.filter(bet => 
      bet.status === 'won' || bet.status === 'lost' || bet.status === 'push'
    );
    
    const totalWinnings = settledBets.reduce((sum, bet) => {
      if (bet.status === 'won') {
        if (bet.type === 'head_to_head' && bet.h2h) {
          return sum + bet.h2h.amount;
        }
        return sum + (bet.betDetails?.amount || 0);
      } else if (bet.status === 'lost') {
        if (bet.type === 'head_to_head' && bet.h2h) {
          return sum - bet.h2h.amount;
        }
        return sum - (bet.betDetails?.amount || 0);
      }
      return sum; // Push bets don't affect winnings
    }, 0);

    return {
      totalBets: totalBetsFromConsensus + totalActualBets,
      totalAtStake: totalAmountFromConsensus + totalActualAmount,
      netWinnings: totalWinnings,
      settledBetsCount: settledBets.length,
      pendingBetsCount: actualBetsThisWeek.filter(bet => bet.status === 'pending' || bet.status === 'live').length
    };
  };

  const weeklyStats = getWeeklyStats();

  const getNextGameGroupKey = () => {
    const now = new Date();
    const groupedGames = groupGamesChronologically(games);
    
    for (const group of groupedGames) {
      const hasUpcomingGames = group.games.some(game => {
        const gameEndTime = new Date(game.gameTime.getTime() + 3 * 60 * 60 * 1000);
        return now < gameEndTime;
      });
      
      if (hasUpcomingGames) {
        return group.key;
      }
    }
    
    return groupedGames[0]?.key || '';
  };

  const groupGamesChronologically = (games: Game[]) => {
    const sortedGames = [...games].sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime());
    const grouped: { key: string; label: string; games: Game[]; gameTime: Date }[] = [];
    
    sortedGames.forEach(game => {
      const dateStr = game.gameTime.toISOString().split('T')[0];
      const groupKey = `${dateStr}-${game.timeSlot}`;
      
      let existingGroup = grouped.find(g => g.key === groupKey);
      if (!existingGroup) {
        const sectionLabels = {
          'thursday': '🌙 Thursday Night Football',
          'sunday-early': '☀️ Sunday Morning Games', 
          'sunday-late': '🌤️ Sunday Afternoon Games',
          'sunday-night': '🌙 Sunday Night Football',
          'monday': '🌙 Monday Night Football'
        };
        
        existingGroup = {
          key: groupKey,
          label: sectionLabels[game.timeSlot] || game.timeSlot,
          games: [],
          gameTime: game.gameTime
        };
        grouped.push(existingGroup);
      }
      existingGroup.games.push(game);
    });
    
    return grouped.sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime());
  };

  const groupedGames = groupGamesChronologically(games);
  const nextGameGroupKey = getNextGameGroupKey();
  const nextGameGroup = groupedGames.find(group => group.key === nextGameGroupKey);

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-green mx-auto mb-4"></div>
            <div className="text-gray-400">Loading alignment data...</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      {nextGameGroup && (
        <div className="space-y-6">
          {/* Next Game Group Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-accent-green/10 border border-accent-green/30">
              <Target className="text-accent-green" size={20} />
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {nextGameGroup.label}
                </h2>
                <div className="text-sm text-gray-400">
                  {nextGameGroup.gameTime.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })} • Group Alignment & Bets
                </div>
              </div>
            </div>
          </div>

          {/* What to Bet - Action-oriented bet placement */}
          <div 
            className="glass rounded-3xl border border-white/10 backdrop-blur-2xl mb-6 overflow-hidden shadow-2xl"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="border-b border-white/10 bg-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <Zap className="text-accent-green" size={20} />
                <div>
                  <h3 className="text-white font-bold text-lg">What to Bet</h3>
                  <p className="text-gray-400 text-sm">Group consensus picks ready to place</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <BetPlacer
                games={nextGameGroup.games}
                selections={selections}
                users={friendGroup}
                currentUserId={currentUserId}
                placedBets={placedBets}
                onPlaceBet={handlePlaceBet}
                onUpdateBet={handleUpdatePlacedBet}
                onDeleteBet={handleDeletePlacedBet}
              />
            </div>
          </div>

          {/* Actual Bets Section */}
          <div 
            className="glass rounded-3xl border border-white/10 backdrop-blur-2xl mb-6 overflow-hidden shadow-2xl"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="border-b border-white/10 bg-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <DollarSign className="text-accent-blue" size={20} />
                <div>
                  <h3 className="text-white font-bold text-lg">Actual Bets</h3>
                  <p className="text-gray-400 text-sm">Track real bets placed by the group</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <ActualBetsTracker
                games={nextGameGroup.games}
                users={friendGroup}
                currentUserId={currentUserId}
                actualBets={actualBets}
                onAddBet={handleAddActualBet}
                onUpdateBet={handleUpdateActualBet}
                onDeleteBet={handleDeleteActualBet}
              />
            </div>
          </div>
        </div>
      )}

      {!nextGameGroup && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No upcoming games found</div>
        </div>
      )}

      {/* Weekly Stats Footer */}
      {(weeklyStats.totalBets > 0 || weeklyStats.totalAtStake > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="text-blue-600" size={16} />
                  <span className="text-sm font-medium text-gray-700">Total Bets</span>
                </div>
                <div className="text-xl font-bold text-blue-600">{weeklyStats.totalBets}</div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="text-green-600" size={16} />
                  <span className="text-sm font-medium text-gray-700">At Stake</span>
                </div>
                <div className="text-xl font-bold text-green-600">${weeklyStats.totalAtStake.toFixed(0)}</div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {weeklyStats.netWinnings > 0 ? (
                    <TrendingUp className="text-green-600" size={16} />
                  ) : weeklyStats.netWinnings < 0 ? (
                    <TrendingDown className="text-red-600" size={16} />
                  ) : (
                    <Minus className="text-gray-600" size={16} />
                  )}
                  <span className="text-sm font-medium text-gray-700">Net P&L</span>
                </div>
                <div className={`text-xl font-bold ${
                  weeklyStats.netWinnings > 0 ? 'text-green-600' : 
                  weeklyStats.netWinnings < 0 ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {weeklyStats.netWinnings > 0 ? '+' : ''}${weeklyStats.netWinnings.toFixed(0)}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                </div>
                <div className="text-xs text-gray-600">
                  <div>{weeklyStats.settledBetsCount} settled</div>
                  <div>{weeklyStats.pendingBetsCount} pending</div>
                </div>
              </div>
            </div>

            <div className="text-center mt-2">
              <div className="text-xs text-gray-500">This Week's Activity</div>
            </div>
          </div>
        </div>
      )}

    </TabLayout>
  );
}
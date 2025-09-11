'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import ConsensusAnalysis from '@/components/ConsensusAnalysis';
import ActualBetsTracker, { ActualBet } from '@/components/ActualBetsTracker';
import HeadToHeadBetCreator from '@/components/HeadToHeadBetCreator';
import TabLayout from '@/components/TabLayout';
import { Target, DollarSign, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

interface BetDetails {
  consensusId: string; // gameId-betType
  amount: number;
  participants: string[];
  betPlacer: string;
  isPlaced: boolean;
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
  const [betDetails, setBetDetails] = useState<BetDetails[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showH2HModal, setShowH2HModal] = useState(false);
  const [selectedGameForH2H, setSelectedGameForH2H] = useState<Game | null>(null);

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

        const savedBetDetails = localStorage.getItem('allegedly-bet-details');
        if (savedBetDetails) {
          setBetDetails(JSON.parse(savedBetDetails));
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

  // Save bet details to localStorage
  useEffect(() => {
    localStorage.setItem('allegedly-bet-details', JSON.stringify(betDetails));
  }, [betDetails]);

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

  const openH2HModal = (game: Game) => {
    setSelectedGameForH2H(game);
    setShowH2HModal(true);
  };

  // Calculate weekly stats
  const getWeeklyStats = () => {
    const totalBetsFromConsensus = betDetails.length;
    const totalAmountFromConsensus = betDetails.reduce((sum, bet) => sum + bet.amount, 0);
    
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

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading alignment data...</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      <div className="space-y-8">
        {/* Group Consensus Section */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Target className="text-green-600" size={24} />
              Group Alignment
            </h2>
            <p className="text-gray-600">
              See where the group is aligned and find the strongest picks
            </p>
          </div>

          <ConsensusAnalysis
            games={games}
            selections={selections}
            users={friendGroup}
            betDetails={betDetails}
            onUpdateBetDetails={setBetDetails}
          />
        </section>

        {/* Head to Head Section - More Subtle */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Plus className="text-purple-600" size={24} />
              Head to Head Bets
            </h2>
            <p className="text-gray-600">
              Create personal matchups - usually ATS between 2 people
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {games.slice(0, 8).map(game => (
                <button
                  key={game.id}
                  onClick={() => openH2HModal(game)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-xs">
                      {game.awayTeam} @ {game.homeTeam}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="text-purple-600" size={14} />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {game.gameTime.toLocaleString('en-US', { 
                      weekday: 'short', 
                      hour: 'numeric',
                      minute: '2-digit' 
                    })}
                  </div>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 text-center mt-3">
              Click any game to create a head-to-head bet
            </div>
          </div>
        </section>

        {/* Actual Bets Tracker */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <DollarSign className="text-green-600" size={24} />
              Actual Bets Placed
            </h2>
            <p className="text-gray-600">
              Track real bets placed by the group with bet slips and results
            </p>
          </div>

          <ActualBetsTracker
            games={games}
            users={friendGroup}
            currentUserId={currentUserId}
            actualBets={actualBets}
            onAddBet={handleAddActualBet}
            onUpdateBet={handleUpdateActualBet}
            onDeleteBet={handleDeleteActualBet}
          />
        </section>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{games.length}</div>
            <div className="text-sm text-gray-600">Games</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{selections.length}</div>
            <div className="text-sm text-gray-600">Vote Picks</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{actualBets.length}</div>
            <div className="text-sm text-gray-600">Actual Bets</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {actualBets.filter(b => b.type === 'head_to_head').length}
            </div>
            <div className="text-sm text-gray-600">H2H Bets</div>
          </div>
        </div>
      </div>

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

      {/* H2H Modal */}
      {showH2HModal && selectedGameForH2H && (
        <HeadToHeadBetCreator
          game={selectedGameForH2H}
          users={friendGroup}
          currentUserId={currentUserId}
          onCreateBet={(bet) => {
            handleAddActualBet(bet);
            setShowH2HModal(false);
          }}
          onClose={() => setShowH2HModal(false)}
        />
      )}
    </TabLayout>
  );
}
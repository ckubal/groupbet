'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import ConsensusAnalysis from '@/components/ConsensusAnalysis';
import ActualBetsTracker, { ActualBet } from '@/components/ActualBetsTracker';
import HeadToHeadBetCreator from '@/components/HeadToHeadBetCreator';
import TabLayout from '@/components/TabLayout';
import { Target, DollarSign, Sword } from 'lucide-react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
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
            .filter((game): game is Game => game !== null);

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

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading consensus data...</div>
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
              Group Consensus
            </h2>
            <p className="text-gray-600">
              See where the group is aligned and find the strongest picks
            </p>
          </div>

          <ConsensusAnalysis
            games={games}
            selections={selections}
            users={friendGroup}
          />
        </section>

        {/* Head to Head Section */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sword className="text-purple-600" size={20} />
              Create Head to Head Bet
            </h3>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.slice(0, 6).map(game => (
              <button
                key={game.id}
                onClick={() => openH2HModal(game)}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
              >
                <div className="font-medium text-sm">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {game.gameTime.toLocaleString('en-US', { 
                    weekday: 'short', 
                    hour: 'numeric',
                    minute: '2-digit' 
                  })}
                </div>
              </button>
            ))}
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
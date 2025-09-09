'use client';

import { useState, useEffect } from 'react';
import { Game, DatabaseService } from '@/lib/database';
import GameCard from '@/components/GameCard';
import ConsensusAnalysis from '@/components/ConsensusAnalysis';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import { Wifi, WifiOff, Target, ChevronDown, ChevronRight, Clock, DollarSign, Trophy } from 'lucide-react';
import { PlayerProp } from '@/components/PlayerPropsDropdown';
import UserSelector from '@/components/UserSelector';
import ActualBetsTracker, { ActualBet } from '@/components/ActualBetsTracker';
import LiveGameTracker from '@/components/LiveGameTracker';
import BettingPerformanceTracker from '@/components/BettingPerformanceTracker';
import WeekendSettlement, { WeeklySettlement } from '@/components/WeekendSettlement';
import SeasonalLedger from '@/components/SeasonalLedger';


// Updated types for new selection system
interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

// Mock data moved to odds-api.ts for centralized fallback

const friendGroup = [
  { id: 'charlie', name: 'Charlie' },
  { id: 'rosen', name: 'Rosen' },
  { id: 'will', name: 'Will' },
  { id: 'do', name: 'D.O.' },
  { id: 'pat', name: 'Pat' },
];

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selections, setSelections] = useState<UserSelection[]>([]);
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([]);
  const [actualBets, setActualBets] = useState<ActualBet[]>([]);
  const [weeklySettlements, setWeeklySettlements] = useState<WeeklySettlement[]>([]);
  const [currentUserId, setCurrentUserId] = useState(''); // No default user
  const [loading, setLoading] = useState(true);
  const [usingApiData, setUsingApiData] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const currentWeek = '2025-week-1';

  // Load cached user ID on page load
  useEffect(() => {
    const cachedUserId = localStorage.getItem('allegedly-user-id');
    if (cachedUserId && friendGroup.some(user => user.id === cachedUserId)) {
      setCurrentUserId(cachedUserId);
    }
  }, []);

  useEffect(() => {
    
    const loadGames = async () => {
      try {
        setLoading(true);
        setApiError(null);

        // Try to load real data from The Odds API
        const apiGames = await oddsApi.getNFLGames();
        
        if (apiGames && apiGames.length > 0) {
          // Transform API games to our format
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
            setUsingApiData(true);
            console.log(`✅ Loaded ${transformedGames.length} games from The Odds API`);
          } else {
            throw new Error('No valid games after transformation');
          }
        } else {
          throw new Error('No games returned from API');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load from The Odds API, using mock data:', error);
        setApiError(error instanceof Error ? error.message : 'Unknown error');
        setGames(getMockNFLGames());
        setUsingApiData(false);
      } finally {
        // Add some mock selections to demonstrate multi-user voting system
        const mockSelections: UserSelection[] = [
          { userId: 'rosen', gameId: 'mock-game-1', betType: 'spread', selection: 'home', createdAt: new Date() },
          { userId: 'will', gameId: 'mock-game-1', betType: 'spread', selection: 'away', createdAt: new Date() },
          { userId: 'charlie', gameId: 'mock-game-1', betType: 'total', selection: 'over', createdAt: new Date() },
          { userId: 'rosen', gameId: 'mock-game-1', betType: 'total', selection: 'under', createdAt: new Date() },
          { userId: 'do', gameId: 'mock-game-2', betType: 'moneyline', selection: 'home', createdAt: new Date() },
          { userId: 'charlie', gameId: 'mock-game-2', betType: 'spread', selection: 'away', createdAt: new Date() },
          { userId: 'pat', gameId: 'mock-game-1', betType: 'moneyline', selection: 'home', createdAt: new Date() },
        ];
        setSelections(mockSelections);
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  const handleSelection = (gameId: string, betType: 'spread' | 'total' | 'moneyline', selection: string) => {
    // Validate user is identified before allowing selections
    if (!currentUserId) {
      alert('Please select your name from the dropdown before making picks!');
      return;
    }

    if (!selection) {
      // Deselect - remove existing selection
      setSelections(prev => prev.filter(s => 
        !(s.userId === currentUserId && s.gameId === gameId && s.betType === betType)
      ));
      return;
    }

    // Remove existing selection for this user/game/betType
    const updatedSelections = selections.filter(s => 
      !(s.userId === currentUserId && s.gameId === gameId && s.betType === betType)
    );

    // Add new selection
    const newSelection: UserSelection = {
      userId: currentUserId,
      gameId,
      betType,
      selection: selection as 'home' | 'away' | 'over' | 'under',
      createdAt: new Date(),
    };

    setSelections([...updatedSelections, newSelection]);

    // In a real app, this would save to Firebase
    console.log('New selection:', newSelection);
  };

  const handlePlayerPropSelection = (prop: PlayerProp) => {
    // Validate user is identified before allowing selections
    if (!currentUserId) {
      alert('Please select your name from the dropdown before making picks!');
      return;
    }

    // Check if prop is already selected
    const existingIndex = playerProps.findIndex(p => p.id === prop.id);
    
    if (existingIndex >= 0) {
      // Remove if already selected (toggle off)
      setPlayerProps(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      // Add new selection
      setPlayerProps(prev => [...prev, prop]);
    }

    // In a real app, this would save to Firebase
    console.log('Player prop selection:', prop);
  };

  const handleUserChange = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('allegedly-user-id', userId);
    console.log('User changed to:', friendGroup.find(u => u.id === userId)?.name);
  };

  const handleAddActualBet = (betData: Omit<ActualBet, 'id' | 'createdAt'>) => {
    const newBet: ActualBet = {
      ...betData,
      id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };
    
    setActualBets(prev => [...prev, newBet]);
    console.log('New actual bet added:', newBet);
  };

  const handleUpdateActualBet = (betId: string, updates: Partial<ActualBet>) => {
    setActualBets(prev => prev.map(bet => 
      bet.id === betId ? { ...bet, ...updates } : bet
    ));
    console.log('Bet updated:', betId, updates);
  };

  const handleDeleteActualBet = (betId: string) => {
    setActualBets(prev => prev.filter(bet => bet.id !== betId));
    console.log('Bet deleted:', betId);
  };

  const handleWeekendSettlement = (settlementData: WeeklySettlement) => {
    setWeeklySettlements(prev => [...prev, settlementData]);
    console.log('Weekend settlement completed:', settlementData);
  };


  const getUserSelections = (gameId: string) => {
    const gameSelections = selections.filter(s => 
      s.userId === currentUserId && s.gameId === gameId
    );

    return {
      spread: gameSelections.find(s => s.betType === 'spread')?.selection as 'home' | 'away' | null || null,
      total: gameSelections.find(s => s.betType === 'total')?.selection as 'over' | 'under' | null || null,
      moneyline: gameSelections.find(s => s.betType === 'moneyline')?.selection as 'home' | 'away' | null || null,
    };
  };

  const getSelectionCounts = (gameId: string) => {
    const gameSelections = selections.filter(s => s.gameId === gameId);
    
    return {
      spread: {
        home: gameSelections.filter(s => s.betType === 'spread' && s.selection === 'home').length,
        away: gameSelections.filter(s => s.betType === 'spread' && s.selection === 'away').length,
      },
      total: {
        over: gameSelections.filter(s => s.betType === 'total' && s.selection === 'over').length,
        under: gameSelections.filter(s => s.betType === 'total' && s.selection === 'under').length,
      },
      moneyline: {
        home: gameSelections.filter(s => s.betType === 'moneyline' && s.selection === 'home').length,
        away: gameSelections.filter(s => s.betType === 'moneyline' && s.selection === 'away').length,
      },
    };
  };

  const getGamePlayerProps = (gameId: string) => {
    return playerProps.filter(prop => prop.gameId === gameId);
  };


  // Helper to determine which game section should be shown next based on current time
  const getNextGameGroupKey = () => {
    const now = new Date();
    
    // Find the first game group that hasn't finished yet
    for (const group of groupedGames) {
      // Check if any game in this group is still upcoming or in progress
      const hasUpcomingGames = group.games.some(game => {
        // Assume games last about 3 hours
        const gameEndTime = new Date(game.gameTime.getTime() + 3 * 60 * 60 * 1000);
        return now < gameEndTime;
      });
      
      if (hasUpcomingGames) {
        return group.key;
      }
    }
    
    // If no upcoming games, return the first group
    return groupedGames[0]?.key || '';
  };

  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

  const isSectionExpanded = (sectionKey: string) => {
    return expandedSections.has(sectionKey);
  };

  // Group games chronologically by actual game date and time slot
  const groupGamesChronologically = (games: Game[]) => {
    // Sort all games by actual game time first
    const sortedGames = [...games].sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime());
    
    // Group by a combination of date and time slot for proper ordering
    const grouped: { key: string; label: string; games: Game[]; gameTime: Date }[] = [];
    
    sortedGames.forEach(game => {
      const dateStr = game.gameTime.toISOString().split('T')[0]; // YYYY-MM-DD
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
    
    // Sort groups by the earliest game time in each group
    return grouped.sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime());
  };

  const groupedGames = groupGamesChronologically(games);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading games...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <header className="text-center py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            NFL Week 1 - Voting & Consensus
          </h1>
          <p className="text-gray-600 mb-3">
            Vote on games to show interest and build group consensus
          </p>
          
          {/* User Selector & Data Source */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <UserSelector
              currentUserId={currentUserId}
              onUserChange={handleUserChange}
              users={friendGroup}
            />
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-white shadow-md border">
              {usingApiData ? (
                <>
                  <Wifi size={16} className="text-green-600" />
                  <span className="text-green-700 font-medium">Live Data</span>
                  <span className="text-gray-500">The Odds API</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-orange-600" />
                  <span className="text-orange-700 font-medium">Demo Data</span>
                  <span className="text-gray-500">Mock odds</span>
                </>
              )}
            </div>
          </div>
          
          
          {apiError && (
            <div className="mt-2 text-xs text-gray-500 max-w-md mx-auto">
              API: {apiError}
            </div>
          )}
        </header>


        {/* Games by Chronological Order */}
        <div className="space-y-8">
          {groupedGames.map((gameGroup, index) => {
            const nextGameGroupKey = getNextGameGroupKey();
            const isNextGame = gameGroup.key === nextGameGroupKey;
            const shouldBeVisible = isNextGame || isSectionExpanded(gameGroup.key);
            const sectionKey = gameGroup.key;

            // Add date info to label for multi-week support
            const gameDate = gameGroup.gameTime.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });

            return (
              <section key={gameGroup.key} className="scroll-mt-8">
                {/* Section Header - Always visible */}
                <div className="text-center mb-6">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg transition-all ${
                      isNextGame 
                        ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                        : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {isNextGame ? (
                      <Clock size={20} className="text-green-600" />
                    ) : (
                      shouldBeVisible ? (
                        <ChevronDown size={20} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={20} className="text-gray-600" />
                      )
                    )}
                    <div>
                      <h2 className="text-xl font-bold mb-1">
                        {gameGroup.label}
                        {isNextGame && <span className="ml-2 text-sm font-normal">(Next Up)</span>}
                      </h2>
                      <div className="text-sm opacity-80">
                        {gameDate} • {gameGroup.games.length} game{gameGroup.games.length !== 1 ? 's' : ''}
                        {!shouldBeVisible && ' - Click to expand'}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Games Grid - Collapsible */}
                {shouldBeVisible && (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {gameGroup.games.map(game => (
                      <GameCard
                        key={game.id}
                        game={game}
                        userSelections={getUserSelections(game.id)}
                        onSelection={handleSelection}
                        selectionCounts={getSelectionCounts(game.id)}
                        selectedPlayerProps={getGamePlayerProps(game.id)}
                        onPlayerPropSelection={handlePlayerPropSelection}
                        onHeadToHeadCreate={handleAddActualBet}
                        users={friendGroup}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Betting Performance */}
        <section className="mt-16 scroll-mt-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Trophy className="text-yellow-600" size={24} />
              Betting Performance
            </h2>
            <p className="text-gray-600">
              Track wins, losses, and overall performance
            </p>
          </div>

          <BettingPerformanceTracker
            actualBets={actualBets}
            users={friendGroup}
          />
        </section>

        {/* Live Game Tracking */}
        <section className="mt-16 scroll-mt-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Clock className="text-blue-600" size={24} />
              Live Game Tracking
            </h2>
            <p className="text-gray-600">
              Real-time scores, player stats, and bet results
            </p>
          </div>

          <LiveGameTracker
            actualBets={actualBets}
            onUpdateBet={handleUpdateActualBet}
          />
        </section>

        {/* Actual Bets Section */}
        <section className="mt-16 scroll-mt-8">
          <div className="text-center mb-8">
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

        {/* Weekend Settlement */}
        <section className="mt-16 scroll-mt-8">
          <WeekendSettlement
            actualBets={actualBets}
            users={friendGroup}
            onSettlement={handleWeekendSettlement}
          />
        </section>

        {/* Seasonal Ledger */}
        <section className="mt-16 scroll-mt-8">
          <SeasonalLedger
            actualBets={actualBets}
            settlements={weeklySettlements}
            users={friendGroup}
          />
        </section>

        {/* Group Consensus Summary */}
        <section className="mt-16 scroll-mt-8">
          <div className="text-center mb-8">
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

          {/* Summary Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{games.length}</div>
              <div className="text-sm text-gray-600">Games</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{selections.length}</div>
              <div className="text-sm text-gray-600">Vote Picks</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{playerProps.length}</div>
              <div className="text-sm text-gray-600">Player Props</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{actualBets.length}</div>
              <div className="text-sm text-gray-600">Actual Bets</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{friendGroup.length}</div>
              <div className="text-sm text-gray-600">Members</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {selections.filter(s => s.userId === currentUserId).length + 
                 playerProps.length + 
                 actualBets.filter(b => b.creator === currentUserId).length}
              </div>
              <div className="text-sm text-gray-600">Your Total</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
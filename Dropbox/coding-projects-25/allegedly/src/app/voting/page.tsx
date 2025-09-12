'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import GameCardHorizontal from '@/components/GameCardHorizontal';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import { Wifi, WifiOff, Clock, ChevronDown, ChevronRight, Vote, CheckCircle } from 'lucide-react';
import { PlayerProp } from '@/components/PlayerPropsDropdown';
import UserSelector from '@/components/UserSelector';
import TabLayout from '@/components/TabLayout';

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

export default function VotingPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selections, setSelections] = useState<UserSelection[]>([]);
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [usingApiData, setUsingApiData] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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
            setUsingApiData(true);
          } else {
            throw new Error('No valid games after transformation');
          }
        } else {
          throw new Error('No games returned from API');
        }
      } catch (error) {
        console.warn('Failed to load from The Odds API, using mock data:', error);
        setApiError(error instanceof Error ? error.message : 'Unknown error');
        setGames(getMockNFLGames());
        setUsingApiData(false);
      } finally {
        // Load saved selections
        const savedSelections = localStorage.getItem('allegedly-selections');
        if (savedSelections) {
          setSelections(JSON.parse(savedSelections));
        }
        
        const savedProps = localStorage.getItem('allegedly-player-props');
        if (savedProps) {
          setPlayerProps(JSON.parse(savedProps));
        }
        
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  // Save selections to localStorage whenever they change
  useEffect(() => {
    if (selections.length > 0) {
      localStorage.setItem('allegedly-selections', JSON.stringify(selections));
    }
  }, [selections]);

  useEffect(() => {
    if (playerProps.length > 0) {
      localStorage.setItem('allegedly-player-props', JSON.stringify(playerProps));
    }
  }, [playerProps]);

  const handleSelection = (gameId: string, betType: 'spread' | 'total' | 'moneyline', selection: string) => {
    if (!currentUserId) {
      alert('Please select your name from the dropdown before making picks!');
      return;
    }

    if (!selection) {
      // Deselect
      setSelections(prev => prev.filter(s => 
        !(s.userId === currentUserId && s.gameId === gameId && s.betType === betType)
      ));
      return;
    }

    const updatedSelections = selections.filter(s => 
      !(s.userId === currentUserId && s.gameId === gameId && s.betType === betType)
    );

    const newSelection: UserSelection = {
      userId: currentUserId,
      gameId,
      betType,
      selection: selection as 'home' | 'away' | 'over' | 'under',
      createdAt: new Date(),
    };

    setSelections([...updatedSelections, newSelection]);
  };

  const handlePlayerPropSelection = (prop: PlayerProp) => {
    if (!currentUserId) {
      alert('Please select your name from the dropdown before making picks!');
      return;
    }

    const existingIndex = playerProps.findIndex(p => p.id === prop.id);
    
    if (existingIndex >= 0) {
      setPlayerProps(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      setPlayerProps(prev => [...prev, prop]);
    }
  };

  const handleUserChange = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('allegedly-user-id', userId);
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

  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

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
  
  // Calculate user stats
  const userVoteCount = selections.filter(s => s.userId === currentUserId).length;
  const userPropCount = playerProps.length;
  const totalVoteCount = userVoteCount + userPropCount;

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading games...</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      {/* User Selection & Data Source */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
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
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-orange-600" />
              <span className="text-orange-700 font-medium">Demo Data</span>
            </>
          )}
        </div>
      </div>

      {/* Games by Time Slot */}
      <div className="space-y-8">
        {groupedGames.map((gameGroup) => {
          const nextGameGroupKey = getNextGameGroupKey();
          const isNextGame = gameGroup.key === nextGameGroupKey;
          const shouldBeVisible = isNextGame || expandedSections.has(gameGroup.key);
          const gameDate = gameGroup.gameTime.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });

          return (
            <section key={gameGroup.key}>
              {/* Section Header */}
              <div className="text-center mb-6">
                <button
                  onClick={() => toggleSection(gameGroup.key)}
                  className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg transition-all ${
                    isNextGame 
                      ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                      : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {isNextGame ? (
                    <Clock size={20} className="text-green-600" />
                  ) : shouldBeVisible ? (
                    <ChevronDown size={20} className="text-gray-600" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-600" />
                  )}
                  <div>
                    <h2 className="text-xl font-bold mb-1">
                      {gameGroup.label}
                      {isNextGame && <span className="ml-2 text-sm font-normal">(Next Up)</span>}
                    </h2>
                    <div className="text-sm opacity-80">
                      {gameDate} • {gameGroup.games.length} game{gameGroup.games.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </button>
              </div>

              {/* Games Grid or Monday Dropdown */}
              {shouldBeVisible && (
                gameGroup.key.includes('monday') ? (
                  /* Monday Night Football Dropdown */
                  <div className="max-w-md mx-auto">
                    <details className="bg-white rounded-lg shadow-md border border-gray-200">
                      <summary className="cursor-pointer p-4 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">
                            {gameGroup.games.length} Monday Game{gameGroup.games.length !== 1 ? 's' : ''}
                          </span>
                          <ChevronDown size={20} className="text-gray-600" />
                        </div>
                      </summary>
                      <div className="p-4 pt-0 space-y-4">
                        {gameGroup.games.map(game => (
                          <GameCardHorizontal
                            key={game.id}
                            game={game}
                            userSelections={getUserSelections(game.id)}
                            onSelection={handleSelection}
                            selectionCounts={getSelectionCounts(game.id)}
                            selectedPlayerProps={getGamePlayerProps(game.id)}
                            onPlayerPropSelection={handlePlayerPropSelection}
                          />
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  /* Regular Games Grid */
                  <div className="space-y-4">
                    {gameGroup.games.map(game => (
                      <GameCardHorizontal
                        key={game.id}
                        game={game}
                        userSelections={getUserSelections(game.id)}
                        onSelection={handleSelection}
                        selectionCounts={getSelectionCounts(game.id)}
                        selectedPlayerProps={getGamePlayerProps(game.id)}
                        onPlayerPropSelection={handlePlayerPropSelection}
                      />
                    ))}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>

      {/* Prominent Floating Footer */}
      {currentUserId && totalVoteCount > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-50">
          <div className="max-w-4xl mx-auto">
            <div 
              className="glass rounded-3xl backdrop-blur-2xl border border-white/20 shadow-2xl p-6"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-accent-blue/20 border border-accent-blue/30">
                    <Vote className="text-accent-blue" size={24} />
                  </div>
                  <div>
                    <div className="text-white text-xl font-bold">
                      {totalVoteCount} picks made
                    </div>
                    <div className="text-gray-400 text-sm">
                      {userVoteCount} games • {userPropCount} props
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    className="px-6 py-3 text-sm text-gray-300 hover:text-white transition-colors"
                    onClick={() => {
                      // Toggle details or show summary
                    }}
                  >
                    view details
                  </button>
                  
                  <a 
                    href="/consensus"
                    className="px-8 py-4 bg-accent-green hover:bg-accent-green/90 text-white font-bold text-lg rounded-2xl transition-all shadow-lg hover:shadow-accent-green/20"
                  >
                    next →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </TabLayout>
  );
}
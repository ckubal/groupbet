'use client';

import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import GameCardHorizontal from '@/components/GameCardHorizontal';
import { oddsApi, getMockNFLGames } from '@/lib/odds-api';
import { Wifi, WifiOff, Clock, ChevronDown, ChevronRight, Search, CheckCircle, Zap, Activity } from 'lucide-react';
import { PlayerProp } from '@/components/PlayerPropsDropdown';
import { useUser } from '@/lib/user-context';
import TabLayout from '@/components/TabLayout';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

export default function VotingPage() {
  const { currentUser, groupMembers, requireAuth } = useUser();
  const [games, setGames] = useState<Game[]>([]);
  const [selections, setSelections] = useState<UserSelection[]>([]);
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingApiData, setUsingApiData] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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
        const mockGames = getMockNFLGames();
        console.log('Loading mock games:', mockGames);
        setGames(mockGames);
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
    requireAuth(() => {
      if (!currentUser) return;
      
      if (!selection) {
        // Deselect
        setSelections(prev => prev.filter(s => 
          !(s.userId === currentUser.id && s.gameId === gameId && s.betType === betType)
        ));
        return;
      }

      const updatedSelections = selections.filter(s => 
        !(s.userId === currentUser.id && s.gameId === gameId && s.betType === betType)
      );

      const newSelection: UserSelection = {
        userId: currentUser.id,
        gameId,
        betType,
        selection: selection as 'home' | 'away' | 'over' | 'under',
        createdAt: new Date(),
      };

      setSelections([...updatedSelections, newSelection]);
    });
  };

  const handlePlayerPropSelection = (prop: PlayerProp) => {
    requireAuth(() => {
      const existingIndex = playerProps.findIndex(p => p.id === prop.id);
      
      if (existingIndex >= 0) {
        setPlayerProps(prev => prev.filter((_, index) => index !== existingIndex));
      } else {
        setPlayerProps(prev => [...prev, prop]);
      }
    });
  };

  const getUserSelections = (gameId: string) => {
    const gameSelections = selections.filter(s => 
      s.userId === currentUser?.id && s.gameId === gameId
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
  const userVoteCount = selections.filter(s => s.userId === currentUser?.id).length;
  const userPropCount = playerProps.length;
  const totalVoteCount = userVoteCount + userPropCount;

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="relative mb-8">
              <div className="animate-spin rounded-full h-16 w-16 border-2 border-accent-blue/20 border-t-accent-blue mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap size={20} className="text-accent-blue animate-pulse" />
              </div>
            </div>
            <div className="text-gray-300 font-medium tracking-wide">initializing neural networks...</div>
            <div className="text-gray-500 text-sm mt-2">analyzing betting patterns</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      {/* User & Data Source */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4">
        <div className="glass rounded-2xl px-3 sm:px-4 py-2 border border-white/10 w-full sm:w-auto">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Activity size={16} className="text-accent-purple" />
            <span className="text-gray-200 font-medium text-xs sm:text-sm">
              {currentUser ? `studying as ${currentUser.name}` : 'observing mode'}
            </span>
          </div>
        </div>
        
        <div className="glass rounded-2xl px-3 sm:px-4 py-2 border border-white/10 w-full sm:w-auto">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            {usingApiData ? (
              <>
                <Wifi size={16} className="text-accent-green" />
                <span className="text-gray-200 font-medium text-xs sm:text-sm">live neural feed</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-accent-pink" />
                <span className="text-gray-200 font-medium text-xs sm:text-sm">simulation mode</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Games by Time Slot */}
      <div className="space-y-12">
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
              <div className="text-center mb-8">
                <button
                  onClick={() => toggleSection(gameGroup.key)}
                  className={`glass-hover interactive rounded-3xl px-8 py-4 transition-all ${
                    isNextGame 
                      ? 'glass border-neon-green text-accent-green glow-green' 
                      : 'glass border-white/10 text-gray-200 hover:border-accent-blue/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {isNextGame ? (
                      <Clock size={22} className="text-accent-green" />
                    ) : shouldBeVisible ? (
                      <ChevronDown size={22} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={22} className="text-gray-400" />
                    )}
                    <div className="text-left">
                      <h2 className="text-xl font-bold mb-1 tracking-wide">
                        {gameGroup.label.toLowerCase()}
                        {isNextGame && <span className="ml-3 text-sm font-normal text-accent-green/80">[active]</span>}
                      </h2>
                      <div className="text-sm text-gray-400 font-medium">
                        {gameDate} • {gameGroup.games.length} game{gameGroup.games.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Games Grid or Monday Dropdown */}
              {shouldBeVisible && (
                gameGroup.key.includes('monday') ? (
                  /* Monday Night Football Dropdown */
                  <div className="max-w-4xl mx-auto">
                    <details className="data-panel rounded-3xl overflow-hidden">
                      <summary className="cursor-pointer p-6 glass-hover interactive">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-accent-purple animate-pulse"></div>
                            <span className="font-semibold text-gray-200 tracking-wide">
                              {gameGroup.games.length} monday game{gameGroup.games.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <ChevronDown size={20} className="text-accent-purple" />
                        </div>
                      </summary>
                      <div className="p-6 pt-0 space-y-6 border-t border-white/10">
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
                    {gameGroup.games.map(game => {
                      console.log('Rendering game:', game);
                      return (
                        <GameCardHorizontal
                          key={game.id}
                          game={game}
                          userSelections={getUserSelections(game.id)}
                          onSelection={handleSelection}
                          selectionCounts={getSelectionCounts(game.id)}
                          selectedPlayerProps={getGamePlayerProps(game.id)}
                          onPlayerPropSelection={handlePlayerPropSelection}
                        />
                      );
                    })}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>

      {/* Floating Footer with Vote Count */}
      {currentUser && totalVoteCount > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-50">
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-3xl border border-white/10 backdrop-blur-2xl p-3 sm:p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 rounded-xl bg-accent-blue/20 border border-accent-blue/30">
                    <Search className="text-accent-blue" size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-100 text-sm sm:text-lg">
                      {totalVoteCount} neural selections
                    </div>
                    <div className="text-xs text-gray-400 hidden sm:block">
                      {userVoteCount} games • {userPropCount} props
                    </div>
                  </div>
                </div>
                
                <details className="relative">
                  <summary className="cursor-pointer interactive glass-hover px-3 sm:px-4 py-2 rounded-2xl border border-accent-blue/30 text-accent-blue hover:border-accent-blue">
                    <span className="text-xs sm:text-sm font-semibold">analyze</span>
                  </summary>
                  <div className="absolute bottom-full right-0 mb-4 data-panel rounded-2xl p-4 min-w-[320px] max-h-[400px] overflow-y-auto">
                    <h4 className="font-bold text-gray-200 mb-4 text-sm tracking-wide">neural analysis</h4>
                    
                    {/* Game Picks */}
                    <div className="space-y-3 text-xs">
                      {games.map(game => {
                        const gameSelections = selections.filter(s => s.userId === currentUser?.id && s.gameId === game.id);
                        if (gameSelections.length === 0) return null;
                        
                        return (
                          <div key={game.id} className="glass rounded-xl p-3 border border-white/10">
                            <div className="font-semibold text-gray-200 mb-2">
                              {game.awayTeam.toLowerCase()} @ {game.homeTeam.toLowerCase()}
                            </div>
                            <div className="space-y-1">
                              {gameSelections.map(sel => (
                                <div key={`${sel.gameId}-${sel.betType}`} className="flex justify-between">
                                  <span className="text-gray-400">{sel.betType}:</span>
                                  <span className="text-accent-blue font-medium">{sel.selection}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Player Props */}
                    {playerProps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="font-semibold text-gray-200 mb-3 text-sm">player algorithms</div>
                        <div className="space-y-2 text-xs">
                          {playerProps.map(prop => (
                            <div key={prop.id} className="glass rounded-lg p-2 border border-white/10 text-gray-300">
                              {prop.description.toLowerCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
    </TabLayout>
  );
}
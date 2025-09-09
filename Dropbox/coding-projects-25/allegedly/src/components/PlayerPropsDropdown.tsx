import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, User, TrendingUp, Activity } from 'lucide-react';
import { oddsApi, PlayerPropsResponse, PlayerPropsOutcome } from '@/lib/odds-api';

interface PlayerPropsDropdownProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  onSelection: (prop: PlayerProp) => void;
  selectedProps: PlayerProp[];
}

export interface PlayerProp {
  id: string;
  gameId: string;
  category: string; // 'player_pass_tds', 'player_rush_yds', etc.
  playerName: string;
  description: string; // 'Patrick Mahomes Over 2.5 Passing TDs'
  line: number;
  overPrice: number;
  underPrice: number;
  bookmaker: string;
}

interface PropCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const propCategories: PropCategory[] = [
  { key: 'player_pass_tds', label: 'Passing TDs', icon: <Activity size={16} /> },
  { key: 'player_pass_yds', label: 'Passing Yards', icon: <TrendingUp size={16} /> },
  { key: 'player_rush_yds', label: 'Rushing Yards', icon: <User size={16} /> },
  { key: 'player_receptions', label: 'Receptions', icon: <Activity size={16} /> },
  { key: 'player_1st_td', label: '1st TD Scorer', icon: <TrendingUp size={16} /> },
  { key: 'player_anytime_td', label: 'Anytime TD', icon: <TrendingUp size={16} /> },
];

export default function PlayerPropsDropdown({ 
  gameId, 
  homeTeam, 
  awayTeam, 
  onSelection, 
  selectedProps 
}: PlayerPropsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [props, setProps] = useState<PlayerProp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (isOpen && props.length === 0) {
      loadPlayerProps();
    }
  }, [isOpen]);

  const loadPlayerProps = async () => {
    setLoading(true);
    setError(null);

    try {
      
      const apiProps = await oddsApi.getPlayerProps(gameId);
      
      
      if (!apiProps) {
        // Use mock data for development
        setProps(getMockPlayerProps(gameId, homeTeam, awayTeam));
        return;
      }

      // Transform API response to our format
      const transformedProps: PlayerProp[] = [];
      const seenProps = new Set<string>(); // Track unique props to avoid duplicates

      // Only use the first bookmaker to avoid duplicates
      const primaryBookmaker = apiProps.bookmakers[0];
      if (primaryBookmaker) {
        primaryBookmaker.markets.forEach(market => {

          // Group outcomes by player (over/under pairs)
          const playerGroups: { [key: string]: PlayerPropsOutcome[] } = {};
          
          market.outcomes.forEach(outcome => {
            // The API returns player name in the description field
            const playerName = outcome.description || 'Unknown Player';
            // Group by player name and the exact bet line (point value)
            const playerKey = `${playerName}_${outcome.point}`;
            if (!playerGroups[playerKey]) {
              playerGroups[playerKey] = [];
            }
            playerGroups[playerKey].push(outcome);
          });

          // Create PlayerProp objects from grouped outcomes
          Object.entries(playerGroups).forEach(([playerKey, outcomes]) => {
            const overOutcome = outcomes.find(o => o.name === 'Over');
            const underOutcome = outcomes.find(o => o.name === 'Under');
            const yesOutcome = outcomes.find(o => o.name === 'Yes');

            // Handle Over/Under bets (passing yards, rushing yards, receptions)
            if (overOutcome && underOutcome && overOutcome.point === underOutcome.point) {
              // Create a unique prop identifier
              const uniquePropId = `${market.key}-${playerKey}`;
              
              // Skip if we've already seen this prop (prevents duplicates)
              if (seenProps.has(uniquePropId)) {
                return;
              }
              seenProps.add(uniquePropId);

              const playerName = overOutcome.description;
              const statType = market.key.replace('player_', '').replace('_', ' ');
              const propDescription = `${playerName} Over ${overOutcome.point} ${statType}`;
              
              const newProp = {
                id: `${gameId}-${uniquePropId}`,
                gameId,
                category: market.key,
                playerName: playerName,
                description: propDescription,
                line: overOutcome.point,
                overPrice: overOutcome.price,
                underPrice: underOutcome.price,
                bookmaker: primaryBookmaker.title,
              };
              
              transformedProps.push(newProp);
            }
            // Handle TD scorer bets (Yes/No or just Yes bets)
            else if (market.key === 'player_1st_td' || market.key === 'player_anytime_td') {
              // Try different outcome names that might be used for TD bets
              const tdOutcome = outcomes.find(o => 
                o.name === 'Yes' || 
                o.name === 'Anytime' || 
                o.name === 'First' || 
                o.name === playerName || 
                outcomes.length === 1 // If there's only one outcome, use it
              ) || outcomes[0]; // Fallback to first outcome
              
              if (tdOutcome) {
                const uniquePropId = `${market.key}-${playerKey}`;
                
                // Skip if we've already seen this prop
                if (seenProps.has(uniquePropId)) {
                  return;
                }
                seenProps.add(uniquePropId);

                const playerName = tdOutcome.description;
                const statType = market.key === 'player_1st_td' ? '1st TD' : 'Anytime TD';
                const propDescription = `${playerName} ${statType}`;
                
                const newProp = {
                  id: `${gameId}-${uniquePropId}`,
                  gameId,
                  category: market.key,
                  playerName: playerName,
                  description: propDescription,
                  line: 0, // TD bets don't have lines
                  overPrice: tdOutcome.price, // TD outcome price
                  underPrice: 0, // No under price for TD bets
                  bookmaker: primaryBookmaker.title,
                };
                
                transformedProps.push(newProp);
              }
            }
          });
        });
      }

      setProps(transformedProps);
    } catch (error) {
      console.error('Failed to load player props:', error);
      setError('Failed to load player props');
      // Fallback to mock data
      setProps(getMockPlayerProps(gameId, homeTeam, awayTeam));
    } finally {
      setLoading(false);
    }
  };

  const getMockPlayerProps = (gameId: string, homeTeam: string, awayTeam: string): PlayerProp[] => {
    // Mock player props based on team names
    const qb1 = getQBForTeam(homeTeam);
    const qb2 = getQBForTeam(awayTeam);
    
    return [
      {
        id: `${gameId}-pass-tds-${qb1.replace(' ', '')}`,
        gameId,
        category: 'player_pass_tds',
        playerName: qb1,
        description: `${qb1} Over 2.5 Passing TDs`,
        line: 2.5,
        overPrice: 120,
        underPrice: -150,
        bookmaker: 'Mock Sportsbook',
      },
      {
        id: `${gameId}-pass-yds-${qb1.replace(' ', '')}`,
        gameId,
        category: 'player_pass_yds',
        playerName: qb1,
        description: `${qb1} Over 275.5 Passing Yards`,
        line: 275.5,
        overPrice: -110,
        underPrice: -110,
        bookmaker: 'Mock Sportsbook',
      },
      {
        id: `${gameId}-pass-tds-${qb2.replace(' ', '')}`,
        gameId,
        category: 'player_pass_tds',
        playerName: qb2,
        description: `${qb2} Over 2.5 Passing TDs`,
        line: 2.5,
        overPrice: 130,
        underPrice: -160,
        bookmaker: 'Mock Sportsbook',
      },
    ];
  };

  const getQBForTeam = (team: string): string => {
    // Mock QB names based on team
    const qbMap: { [key: string]: string } = {
      'Chiefs': 'Patrick Mahomes',
      'Kansas City Chiefs': 'Patrick Mahomes',
      'Ravens': 'Lamar Jackson',
      'Baltimore Ravens': 'Lamar Jackson',
      'Cowboys': 'Dak Prescott',
      'Dallas Cowboys': 'Dak Prescott',
      'Giants': 'Daniel Jones',
      'New York Giants': 'Daniel Jones',
      '49ers': 'Brock Purdy',
      'San Francisco 49ers': 'Brock Purdy',
      'Rams': 'Matthew Stafford',
      'Los Angeles Rams': 'Matthew Stafford',
      'Bills': 'Josh Allen',
      'Buffalo Bills': 'Josh Allen',
      'Dolphins': 'Tua Tagovailoa',
      'Miami Dolphins': 'Tua Tagovailoa',
      'Broncos': 'Russell Wilson',
      'Denver Broncos': 'Russell Wilson',
      'Raiders': 'Jimmy Garoppolo',
      'Las Vegas Raiders': 'Jimmy Garoppolo',
    };
    return qbMap[team] || 'Unknown QB';
  };

  const filteredProps = selectedCategory === 'all' 
    ? props 
    : props.filter(prop => prop.category === selectedCategory);

  // Group props by player name for better organization
  const groupedByPlayer = filteredProps.reduce((groups, prop) => {
    const playerName = prop.playerName;
    if (!groups[playerName]) {
      groups[playerName] = [];
    }
    groups[playerName].push(prop);
    return groups;
  }, {} as { [playerName: string]: PlayerProp[] });

  // Function to determine which team a player belongs to
  const getPlayerTeam = (playerName: string): 'away' | 'home' | 'unknown' => {
    // Common team player mappings - this could be expanded with a more comprehensive database
    const teamPlayers: { [key: string]: { [player: string]: 'away' | 'home' } } = {
      // Vikings (away) vs Bears (home) - Monday Night Football
      'Minnesota Vikings vs Chicago Bears': {
        'J.J. McCarthy': 'away', 'Sam Darnold': 'away', 'Justin Jefferson': 'away', 
        'Aaron Jones': 'away', 'Jordan Addison': 'away', 'T.J. Hockenson': 'away',
        'Caleb Williams': 'home', 'DJ Moore': 'home', 'Rome Odunze': 'home', 
        'Cole Kmet': 'home', "D'Andre Swift": 'home', 'Keenan Allen': 'home'
      }
    };

    // Create a simple key - this is a basic implementation
    const gameKey = `${awayTeam} vs ${homeTeam}`;
    const players = teamPlayers[gameKey];
    
    if (players && players[playerName]) {
      return players[playerName];
    }

    // Fallback: try to infer from team names in player props or use heuristics
    // For now, return unknown
    return 'unknown';
  };

  // Function to determine player position and team
  const getPlayerInfo = (playerName: string, playerProps: PlayerProp[]) => {
    // Determine position based on prop types
    const propTypes = playerProps.map(p => p.category);
    
    let position = 'OTHER';
    if (propTypes.includes('player_pass_yds') || propTypes.includes('player_pass_tds')) {
      position = 'QB';
    } else if (propTypes.includes('player_rush_yds') && !propTypes.includes('player_pass_yds')) {
      position = 'RB';
    } else if (propTypes.includes('player_receptions')) {
      // If they have receptions but no passing, likely WR/TE
      position = propTypes.includes('player_rush_yds') ? 'RB' : 'WR'; // RBs can have receptions too
    }

    // Get team info
    const team = getPlayerTeam(playerName);

    // Calculate prominence score
    const totalProps = playerProps.length;
    const hasPassingProps = propTypes.includes('player_pass_yds') || propTypes.includes('player_pass_tds');
    const hasRushingProps = propTypes.includes('player_rush_yds');
    const hasReceivingProps = propTypes.includes('player_receptions');

    let prominence = totalProps;
    if (hasPassingProps) prominence += 10; // QBs are always prominent
    if (hasRushingProps && hasReceivingProps) prominence += 5; // Dual-threat players
    if (position === 'QB') prominence += 20; // QBs get highest priority

    return { position, prominence, totalProps, team };
  };

  // Sort players by position and prominence
  const sortedPlayers = Object.keys(groupedByPlayer).sort((a, b) => {
    const aInfo = getPlayerInfo(a, groupedByPlayer[a]);
    const bInfo = getPlayerInfo(b, groupedByPlayer[b]);

    // Position priority: QB > RB > WR > OTHER
    const positionOrder = { 'QB': 0, 'RB': 1, 'WR': 2, 'OTHER': 3 };
    const aPos = positionOrder[aInfo.position as keyof typeof positionOrder] ?? 4;
    const bPos = positionOrder[bInfo.position as keyof typeof positionOrder] ?? 4;

    if (aPos !== bPos) {
      return aPos - bPos;
    }

    // Special handling for QBs: away team QB first, then home team QB
    if (aInfo.position === 'QB' && bInfo.position === 'QB') {
      const teamOrder = { 'away': 0, 'home': 1, 'unknown': 2 };
      const aTeam = teamOrder[aInfo.team as keyof typeof teamOrder] ?? 3;
      const bTeam = teamOrder[bInfo.team as keyof typeof teamOrder] ?? 3;
      
      if (aTeam !== bTeam) {
        return aTeam - bTeam;
      }
    }

    // Within same position and team, sort by prominence (more props = more important)
    if (aInfo.prominence !== bInfo.prominence) {
      return bInfo.prominence - aInfo.prominence;
    }

    // Finally, alphabetical
    return a.localeCompare(b);
  });

  const formatPrice = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`;
  };

  const handlePropSelection = (prop: PlayerProp) => {
    onSelection(prop);
    // Keep dropdown open for multiple selections
  };

  const isPropSelected = (prop: PlayerProp) => {
    return selectedProps.some(selected => selected.id === prop.id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <User size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Player Props {selectedProps.length > 0 && `(${selectedProps.length})`}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-600" />
        ) : (
          <ChevronDown size={16} className="text-gray-600" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-96 overflow-hidden">
          {/* Category Filter */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-1 text-xs rounded ${
                  selectedCategory === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              {propCategories.map(category => (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                    selectedCategory === category.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {category.icon}
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Props List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Loading props...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-600 text-sm">
                {error}
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No props available for this category
              </div>
            ) : (
              <div className="space-y-3 p-2">
                {sortedPlayers.map(playerName => (
                  <div key={playerName} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Player Header */}
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-800">{playerName}</div>
                        <div className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          {getPlayerInfo(playerName, groupedByPlayer[playerName]).position}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{groupedByPlayer[playerName].length} available bets</div>
                    </div>
                    
                    {/* Player Props */}
                    <div className="space-y-1 p-2">
                      {groupedByPlayer[playerName]
                        .sort((a, b) => {
                          // Put TD props at the bottom
                          const aIsTD = a.category === 'player_1st_td' || a.category === 'player_anytime_td';
                          const bIsTD = b.category === 'player_1st_td' || b.category === 'player_anytime_td';
                          
                          if (aIsTD && !bIsTD) return 1;
                          if (!aIsTD && bIsTD) return -1;
                          
                          // Within TD props, put first TD before anytime TD
                          if (aIsTD && bIsTD) {
                            if (a.category === 'player_1st_td') return -1;
                            if (b.category === 'player_1st_td') return 1;
                          }
                          
                          return 0;
                        })
                        .map(prop => (
                        <div key={prop.id} className="border border-gray-100 rounded p-2">
                          <div className="text-xs text-gray-600 mb-2">
                            {prop.category.replace('player_', '').replace('_', ' ').toUpperCase()}{prop.line > 0 ? ` - ${prop.line}` : ''}
                          </div>
                          
                          {/* TD Scorer bets (single button) */}
                          {(prop.category === 'player_1st_td' || prop.category === 'player_anytime_td') ? (
                            <button
                              onClick={() => handlePropSelection({...prop, description: prop.description})}
                              className={`w-full p-2 rounded text-xs border transition-colors ${
                                isPropSelected(prop)
                                  ? 'border-green-500 bg-green-100 text-green-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {prop.category === 'player_1st_td' ? 'First TD' : 'Anytime TD'} ({formatPrice(prop.overPrice)})
                            </button>
                          ) : (
                            /* Over/Under bets (two buttons) */
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                onClick={() => handlePropSelection({...prop, description: `${prop.playerName} Over ${prop.line} ${prop.category.replace('player_', '').replace('_', ' ')}`})}
                                className={`p-1 rounded text-xs border transition-colors ${
                                  isPropSelected(prop) && selectedProps.some(p => p.id === prop.id && p.description.includes('Over'))
                                    ? 'border-green-500 bg-green-100 text-green-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Over {prop.line} ({formatPrice(prop.overPrice)})
                              </button>
                              <button
                                onClick={() => handlePropSelection({...prop, description: `${prop.playerName} Under ${prop.line} ${prop.category.replace('player_', '').replace('_', ' ')}`})}
                                className={`p-1 rounded text-xs border transition-colors ${
                                  isPropSelected(prop) && selectedProps.some(p => p.id === prop.id && p.description.includes('Under'))
                                    ? 'border-green-500 bg-green-100 text-green-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Under {prop.line} ({formatPrice(prop.underPrice)})
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              {selectedProps.length} props selected
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/**
 * The Odds API Integration Service
 * Fetches real NFL odds data from The Odds API
 */

export interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsMarket {
  key: string; // 'h2h' (moneyline), 'spreads', 'totals'
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsOutcome {
  name: string;
  price: number; // American odds
  point?: number; // Spread/total line
  description?: string; // Player name for player props
}

export interface PlayerPropsResponse {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: PlayerPropsBookmaker[];
}

export interface PlayerPropsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: PlayerPropsMarket[];
}

export interface PlayerPropsMarket {
  key: string; // e.g., 'player_pass_tds', 'player_rush_yds'
  last_update: string;
  outcomes: PlayerPropsOutcome[];
}

export interface PlayerPropsOutcome {
  name: string;
  description: string;
  price: number;
  point: number;
}

export interface LiveGameScore {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  scores?: {
    name: string;
    score: string;
  }[];
  last_update?: string;
  completed: boolean;
}

export interface PlayerStats {
  player_name: string;
  position: string;
  team: string;
  stats: {
    passing_yards?: number;
    passing_tds?: number;
    rushing_yards?: number;
    receptions?: number;
    receiving_yards?: number;
    receiving_tds?: number;
    first_td?: boolean;
    anytime_td?: boolean;
  };
}

class OddsApiService {
  private baseUrl = 'https://api.the-odds-api.com/v4';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY || '';
    
    
    if (!this.apiKey) {
      console.warn('⚠️ The Odds API key not found. Using mock data.');
    }
  }

  /**
   * Get current NFL games with odds
   */
  async getNFLGames(): Promise<OddsApiGame[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/sports/americanfootball_nfl/odds/?` +
        new URLSearchParams({
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american',
          dateFormat: 'iso',
        })
      );

      if (!response.ok) {
        throw new Error(`The Odds API error: ${response.status} ${response.statusText}`);
      }

      const data: OddsApiGame[] = await response.json();
      
      // Log API usage info from response headers
      const requestsUsed = response.headers.get('x-requests-used');
      const requestsRemaining = response.headers.get('x-requests-remaining');
      
      console.log(`📊 The Odds API - Used: ${requestsUsed}, Remaining: ${requestsRemaining}`);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch NFL games from The Odds API:', error);
      return [];
    }
  }

  /**
   * Get player props for a specific game
   * Uses the event-specific endpoint: /events/{eventId}/odds
   */
  async getPlayerProps(gameId: string): Promise<PlayerPropsResponse | null> {
    // Force use of NEXT_PUBLIC key for client-side calls
    const clientApiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    
    if (!clientApiKey) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/sports/americanfootball_nfl/events/${gameId}/odds?` +
        new URLSearchParams({
          apiKey: clientApiKey,
          regions: 'us',
          markets: 'player_pass_yds,player_pass_tds,player_rush_yds,player_receptions,player_1st_td,player_anytime_td',
          oddsFormat: 'american',
          dateFormat: 'iso',
        });
      
      // Use the event-specific endpoint for player props
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 422) {
          const errorText = await response.text();
          console.warn('⚠️ Player props request failed:', response.status, errorText);
          
          // Check if it's a subscription issue vs market availability
          if (errorText.includes('Markets not supported')) {
            console.warn('⚠️ Player props markets not supported by current API subscription');
          } else if (errorText.includes('Event not found')) {
            console.warn('⚠️ Event not found - may not have player props available yet');
          }
          return null;
        }
        throw new Error(`The Odds API error: ${response.status} ${response.statusText}`);
      }

      const data: OddsApiGame = await response.json();
      
      // Success - API returned player props data

      // Convert to expected format
      return {
        id: data.id,
        sport_key: data.sport_key,
        commence_time: data.commence_time,
        home_team: data.home_team,
        away_team: data.away_team,
        bookmakers: data.bookmakers.map(bookmaker => ({
          key: bookmaker.key,
          title: bookmaker.title,
          last_update: bookmaker.last_update,
          markets: bookmaker.markets.filter(market => 
            market.key.startsWith('player_')
          ).map(market => ({
            key: market.key,
            last_update: market.last_update,
            outcomes: market.outcomes.map(outcome => ({
              name: outcome.name,
              description: outcome.description, // Preserve original description which should contain player name
              price: outcome.price,
              point: outcome.point || 0,
            }))
          }))
        }))
      };
    } catch (error) {
      console.error('❌ Failed to fetch player props from The Odds API:', error);
      return null;
    }
  }

  /**
   * Convert The Odds API format to our internal Game format
   */
  transformApiGameToGame(apiGame: OddsApiGame) {
    // Find the best bookmaker (prioritize DraftKings, FanDuel, etc.)
    const preferredBookmakers = ['draftkings', 'fanduel', 'betmgm', 'pointsbetus'];
    let bookmaker = apiGame.bookmakers[0]; // Default to first

    for (const preferred of preferredBookmakers) {
      const found = apiGame.bookmakers.find(b => b.key === preferred);
      if (found) {
        bookmaker = found;
        break;
      }
    }

    if (!bookmaker) {
      throw new Error(`No bookmaker data found for game ${apiGame.id}`);
    }

    // Extract markets
    const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
    const totalMarket = bookmaker.markets.find(m => m.key === 'totals');
    const moneylineMarket = bookmaker.markets.find(m => m.key === 'h2h');

    // Parse spread
    const homeSpread = spreadMarket?.outcomes.find(o => o.name === apiGame.home_team);
    const awaySpread = spreadMarket?.outcomes.find(o => o.name === apiGame.away_team);
    
    // Parse total
    const overOutcome = totalMarket?.outcomes.find(o => o.name === 'Over');
    const underOutcome = totalMarket?.outcomes.find(o => o.name === 'Under');

    // Parse moneyline
    const homeMoneyline = moneylineMarket?.outcomes.find(o => o.name === apiGame.home_team);
    const awayMoneyline = moneylineMarket?.outcomes.find(o => o.name === apiGame.away_team);

    // Determine time slot based on game time (using Pacific time for Sunday classifications)
    const gameTime = new Date(apiGame.commence_time);
    const dayOfWeek = gameTime.getDay();
    
    // Convert to Pacific time for Sunday game classification
    const pacificTime = new Date(gameTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    const pacificHour = pacificTime.getHours();
    
    let timeSlot: 'thursday' | 'sunday-early' | 'sunday-late' | 'sunday-night' | 'monday';
    
    if (dayOfWeek === 4) { // Thursday
      timeSlot = 'thursday';
    } else if (dayOfWeek === 0) { // Sunday - using Pacific time
      if (pacificHour <= 10) { // 10 AM PT or earlier = morning
        timeSlot = 'sunday-early';
      } else if (pacificHour < 16) { // 12:30 PM PT area = afternoon  
        timeSlot = 'sunday-late';
      } else { // 4 PM PT or later = night
        timeSlot = 'sunday-night';
      }
    } else if (dayOfWeek === 1) { // Monday
      timeSlot = 'monday';
    } else {
      timeSlot = 'sunday-early'; // Default fallback
    }

    return {
      id: apiGame.id,
      week: `2025-week-1`, // TODO: Calculate actual week
      season: 2025,
      homeTeam: apiGame.home_team,
      awayTeam: apiGame.away_team,
      gameTime: gameTime,
      timeSlot,
      status: 'scheduled' as const,
      homeScore: 0,
      awayScore: 0,
      odds: {
        spread: {
          line: homeSpread?.point ? `${homeSpread.point}` : 'N/A',
          odds: homeSpread?.price ? (homeSpread.price > 0 ? `+${homeSpread.price}` : `${homeSpread.price}`) : 'N/A'
        },
        total: {
          line: overOutcome?.point ? `${overOutcome.point}` : 'N/A',
          odds: overOutcome?.price ? (overOutcome.price > 0 ? `+${overOutcome.price}` : `${overOutcome.price}`) : 'N/A'
        },
        moneyline: {
          home: homeMoneyline?.price ? (homeMoneyline.price > 0 ? `+${homeMoneyline.price}` : `${homeMoneyline.price}`) : 'N/A',
          away: awayMoneyline?.price ? (awayMoneyline.price > 0 ? `+${awayMoneyline.price}` : `${awayMoneyline.price}`) : 'N/A'
        }
      },
      updatedAt: new Date(bookmaker.last_update),
    };
  }

  /**
   * Get live scores for NFL games
   */
  async getLiveScores(): Promise<LiveGameScore[]> {
    const clientApiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    
    if (!clientApiKey) {
      console.warn('⚠️ No API key for live scores, using mock data');
      return this.getMockLiveScores();
    }

    try {
      const url = `${this.baseUrl}/sports/americanfootball_nfl/scores?` +
        new URLSearchParams({
          apiKey: clientApiKey,
          daysFrom: '3', // Get scores from 3 days ago
          dateFormat: 'iso',
        });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Live scores API error: ${response.status} ${response.statusText}`);
      }

      const data: LiveGameScore[] = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch live scores:', error);
      return this.getMockLiveScores();
    }
  }

  /**
   * Mock live scores for development/fallback
   */
  private getMockLiveScores(): LiveGameScore[] {
    return [
      {
        id: 'mock-game-1',
        sport_key: 'americanfootball_nfl',
        commence_time: '2025-09-12T20:20:00Z',
        home_team: 'Kansas City Chiefs',
        away_team: 'Baltimore Ravens',
        scores: [
          { name: 'Kansas City Chiefs', score: '24' },
          { name: 'Baltimore Ravens', score: '17' }
        ],
        completed: true,
        last_update: new Date().toISOString()
      }
    ];
  }

  /**
   * Get player stats for live games (mock implementation)
   * Note: The Odds API doesn't provide live player stats, so this would need
   * integration with ESPN API, NFL API, or another sports data provider
   */
  async getPlayerStats(gameId: string): Promise<PlayerStats[]> {
    // Mock player stats for demo
    return [
      {
        player_name: 'Lamar Jackson',
        position: 'QB',
        team: 'Baltimore Ravens',
        stats: {
          passing_yards: 245,
          passing_tds: 2,
          rushing_yards: 62,
          first_td: false
        }
      },
      {
        player_name: 'Patrick Mahomes',
        position: 'QB', 
        team: 'Kansas City Chiefs',
        stats: {
          passing_yards: 312,
          passing_tds: 3,
          rushing_yards: 18,
          first_td: false
        }
      },
      {
        player_name: 'Travis Kelce',
        position: 'TE',
        team: 'Kansas City Chiefs',
        stats: {
          receptions: 7,
          receiving_yards: 93,
          receiving_tds: 1,
          first_td: true,
          anytime_td: true
        }
      }
    ];
  }

  /**
   * Evaluate bet results based on live game data
   */
  evaluateBetResult(bet: any, liveScore: LiveGameScore, playerStats: PlayerStats[]): 'won' | 'lost' | 'push' | 'pending' {
    if (!liveScore.completed) {
      return 'pending';
    }

    const homeScore = parseInt(liveScore.scores?.find(s => s.name === liveScore.home_team)?.score || '0');
    const awayScore = parseInt(liveScore.scores?.find(s => s.name === liveScore.away_team)?.score || '0');

    switch (bet.betDetails.betType) {
      case 'moneyline':
        const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'push';
        if (winner === 'push') return 'push';
        return bet.betDetails.selection === winner ? 'won' : 'lost';

      case 'spread':
        // Parse spread (e.g., "Chiefs -3.5" -> -3.5)
        const spreadMatch = bet.betDetails.selection.match(/([+-]?\d+\.?\d*)/);
        if (!spreadMatch) return 'pending';
        
        const spread = parseFloat(spreadMatch[1]);
        const adjustedHomeScore = homeScore + spread;
        
        if (bet.betDetails.selection.includes('home') || bet.betDetails.selection.includes(liveScore.home_team)) {
          return adjustedHomeScore > awayScore ? 'won' : adjustedHomeScore < awayScore ? 'lost' : 'push';
        } else {
          return awayScore > adjustedHomeScore ? 'won' : awayScore < adjustedHomeScore ? 'lost' : 'push';
        }

      case 'total':
        const totalScore = homeScore + awayScore;
        const totalLine = parseFloat(bet.betDetails.selection.match(/(\d+\.?\d*)/)?.[1] || '0');
        
        if (bet.betDetails.selection.toLowerCase().includes('over')) {
          return totalScore > totalLine ? 'won' : totalScore < totalLine ? 'lost' : 'push';
        } else {
          return totalScore < totalLine ? 'won' : totalScore > totalLine ? 'lost' : 'push';
        }

      case 'player_prop':
        // Find the player's actual stats
        const playerName = bet.betDetails.selection.split(' ')[0] + ' ' + bet.betDetails.selection.split(' ')[1];
        const playerStat = playerStats.find(p => p.player_name === playerName);
        
        if (!playerStat) return 'pending';

        // This would need more sophisticated parsing of the bet description
        // For now, return pending for player props
        return 'pending';

      default:
        return 'pending';
    }
  }

  /**
   * Get current NFL week number
   */
  getCurrentNFLWeek(): number {
    // NFL season typically starts first week of September
    // This is a simplified calculation - in production you'd want more accurate date handling
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    
    if (now < seasonStart) {
      return 1; // Preseason or early season
    }
    
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 18); // NFL has 18 weeks
  }
}

// Export singleton instance
export const oddsApi = new OddsApiService();

// Mock data fallback for development
export const getMockNFLGames = () => [
  {
    id: 'mock-game-1',
    week: '2025-week-1',
    season: 2025,
    homeTeam: 'Kansas City Chiefs',
    awayTeam: 'Baltimore Ravens',
    gameTime: new Date('2025-09-12T20:20:00'),
    timeSlot: 'thursday' as const,
    status: 'scheduled' as const,
    homeScore: 0,
    awayScore: 0,
    odds: {
      spread: { line: 'KC -2.5', odds: '-110' },
      total: { line: '51.5', odds: '-110' },
      moneyline: { home: '-140', away: '+120' }
    },
    updatedAt: new Date(),
  },
  {
    id: 'mock-game-2', 
    week: '2025-week-1',
    season: 2025,
    homeTeam: 'Dallas Cowboys',
    awayTeam: 'New York Giants',
    gameTime: new Date('2025-09-15T13:00:00'),
    timeSlot: 'sunday-early' as const,
    status: 'scheduled' as const,
    homeScore: 0,
    awayScore: 0,
    odds: {
      spread: { line: 'DAL -7.5', odds: '-110' },
      total: { line: '48.5', odds: '-110' },
      moneyline: { home: '-300', away: '+250' }
    },
    updatedAt: new Date(),
  },
];
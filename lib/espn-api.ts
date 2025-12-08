import { Game } from '@/types';

interface ESPNCompetitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: 'home' | 'away';
  team: {
    id: string;
    uid: string;
    location: string;
    name: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    color: string;
    alternateColor: string;
    isActive: boolean;
    logo: string;
  };
  score: string;
  statistics: any[];
  records: any[];
  linescores: any[];
}

interface ESPNCompetition {
  id: string;
  uid: string;
  date: string;
  attendance: number;
  type: {
    id: string;
    abbreviation: string;
  };
  timeValid: boolean;
  neutralSite: boolean;
  conferenceCompetition: boolean;
  playByPlayAvailable: boolean;
  recent: boolean;
  venue: {
    id: string;
    fullName: string;
    address: {
      city: string;
      state: string;
    };
    indoor: boolean;
  };
  competitors: ESPNCompetitor[];
  notes: any[];
  status: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
  };
  broadcasts: any[];
  format: {
    regulation: {
      periods: number;
    };
  };
  startDate: string;
  geoBroadcasts: any[];
}

interface ESPNEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: {
    year: number;
    type: number;
    slug: string;
  };
  week: {
    number: number;
  };
  competitions: ESPNCompetition[];
  links: any[];
  status: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
  };
}

interface ESPNScoreboardResponse {
  leagues: any[];
  season: {
    type: number;
    year: number;
  };
  week: {
    number: number;
  };
  events: ESPNEvent[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ESPNApiService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
  private cache = new Map<string, CacheEntry<any>>();
  private LIVE_CACHE_DURATION = 30 * 1000; // 30 seconds for live games
  private FINAL_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for completed games

  private getCacheKey(endpoint: string, params?: Record<string, string>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `espn:${endpoint}:${paramStr}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, duration: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
    });
  }

  async getScoreboard(week?: number): Promise<ESPNScoreboardResponse | null> {
    const params = week ? { week: String(week) } : undefined;
    const cacheKey = this.getCacheKey('scoreboard', params);
    const cached = this.getFromCache<ESPNScoreboardResponse>(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached ESPN scoreboard');
      return cached;
    }

    try {
      // Use proper parameters for all weeks in the 2025 season
      let url = `${this.baseUrl}/scoreboard`;
      if (week) {
        url += `?week=${week}&seasontype=2&year=2025`;
        console.log(`📺 Fetching ESPN Week ${week} 2025 with specific parameters`);
      } else {
        // Default to current week if no week specified
        url += `?seasontype=2&year=2025`;
        console.log('📺 Fetching ESPN current week 2025');
      }

      console.log(`📡 ESPN API call: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data: ESPNScoreboardResponse = await response.json();
      
      console.log(`✅ ESPN API Success: Season ${data.season?.year}, Week ${data.week?.number}`);
      console.log(`📊 Found ${data.events?.length || 0} real NFL games`);
      
      // Log all games received
      if (data.events && data.events.length > 0) {
        console.log('🏈 Real ESPN games received:');
        data.events.forEach((event, i) => {
          const comp = event.competitions?.[0];
          if (comp) {
            const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
            const status = comp.status?.type?.description || 'Unknown';
            console.log(`   ${i+1}. ${away?.team?.displayName || 'Away'} @ ${home?.team?.displayName || 'Home'} | ${status} | ${away?.score || 0}-${home?.score || 0}`);
          } else {
            console.log(`   ${i+1}. Event ${event.id} - Missing competition data`);
          }
        });
      } else {
        console.warn(`⚠️ ESPN API returned empty events array for Week ${week}`);
        console.log(`📋 Response structure:`, {
          hasEvents: !!data.events,
          eventsLength: data.events?.length,
          week: data.week,
          season: data.season
        });
      }
      
      // Determine cache duration based on game states
      let cacheDuration = this.FINAL_CACHE_DURATION;
      const hasLiveGames = data.events.some(event => 
        event.status.type.state === 'in' || 
        event.status.type.description === 'In Progress'
      );
      
      if (hasLiveGames) {
        cacheDuration = this.LIVE_CACHE_DURATION;
      }
      
      this.setCache(cacheKey, data, cacheDuration);
      console.log(`✅ ESPN data cached for ${cacheDuration / 1000}s`);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch ESPN scoreboard:', error);
      return null;
    }
  }

  updateGamesWithLiveData(games: Game[], espnData: ESPNScoreboardResponse): Game[] {
    console.log('📊 ESPN API GAME MATCHING SUMMARY:');
    console.log(`📦 Input games from Odds API: ${games.length}`);
    console.log(`📺 ESPN events available: ${espnData.events.length}`);
    
    // Log all available ESPN games
    console.log('📺 Available ESPN games:');
    espnData.events.forEach((event, index) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      console.log(`   ${index + 1}. ${awayTeam?.team.displayName} @ ${homeTeam?.team.displayName} | ${event.status.type.description}`);
    });
    
    return games.map(game => {
      // Find matching ESPN game
      const espnEvent = espnData.events.find(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const isMatch = (
          homeTeam?.team.displayName === game.homeTeam &&
          awayTeam?.team.displayName === game.awayTeam
        );
        
        if (isMatch) {
          console.log(`✅ ESPN MATCH: ${game.awayTeam} @ ${game.homeTeam}`);
        }
        
        return isMatch;
      });
      
      if (!espnEvent) {
        console.log(`❌ NO ESPN MATCH: ${game.awayTeam} @ ${game.homeTeam}`);
      }

      if (!espnEvent) return game;

      const competition = espnEvent.competitions[0];
      const status = competition.status;
      const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

      // Update game status
      let gameStatus: Game['status'] = 'upcoming';
      if (status.type.completed) {
        gameStatus = 'final';
      } else if (status.type.state === 'in' || status.type.description === 'In Progress') {
        gameStatus = 'live';
      }

      // Extract live game situation data
      const liveData = gameStatus === 'live' ? this.extractLiveGameSituation(espnEvent) : null;

      return {
        ...game,
        status: gameStatus,
        homeScore: homeCompetitor ? parseInt(homeCompetitor.score) : game.homeScore,
        awayScore: awayCompetitor ? parseInt(awayCompetitor.score) : game.awayScore,
        // Add live game situation data
        quarter: liveData?.quarter || undefined,
        timeRemaining: liveData?.timeRemaining || undefined,
        possession: liveData?.possession || undefined,
        yardLine: liveData?.yardLine || undefined,
        fieldPosition: liveData?.fieldPosition || undefined,
        isRedZone: liveData?.isRedZone || false,
      };
    });
  }

  /**
   * Fetch player statistics for a specific game
   */
  async getGameStats(espnGameId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/summary?event=${espnGameId}`;
      console.log(`📊 Fetching player stats for game ${espnGameId}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch stats for game ${espnGameId}`);
        return null;
      }
      
      const data = await response.json();
      return this.extractPlayerStats(data);
    } catch (error) {
      console.error(`❌ Error fetching game stats:`, error);
      return null;
    }
  }

  /**
   * Extract player statistics from ESPN game summary
   */
  private extractPlayerStats(gameSummary: any): Record<string, any> {
    const stats: Record<string, any> = {};
    
    try {
      // ESPN provides boxscore data with player statistics
      const boxscore = gameSummary.boxscore;
      if (!boxscore || !boxscore.players) {
        return stats;
      }
      
      // Process each team's players
      boxscore.players.forEach((teamPlayers: any) => {
        const teamName = teamPlayers.team.displayName;
        
        // Process different stat categories
        ['passing', 'rushing', 'receiving'].forEach(category => {
          if (teamPlayers.statistics && teamPlayers.statistics.find((s: any) => s.name === category)) {
            const categoryStats = teamPlayers.statistics.find((s: any) => s.name === category);
            
            categoryStats.athletes.forEach((athlete: any) => {
              const playerId = athlete.athlete.id;
              const playerName = athlete.athlete.displayName;
              
              // Extract relevant stats based on category
              if (category === 'passing' && athlete.stats.length >= 3) {
                stats[`${playerId}_passing`] = {
                  playerId,
                  playerName,
                  team: teamName,
                  passingYards: parseInt(athlete.stats[1] || 0), // Usually yards is 2nd stat
                  passingTDs: parseInt(athlete.stats[2] || 0), // TDs usually 3rd
                  completions: parseInt(athlete.stats[0]?.split('/')[0] || 0),
                  attempts: parseInt(athlete.stats[0]?.split('/')[1] || 0),
                };
              } else if (category === 'rushing' && athlete.stats.length >= 3) {
                stats[`${playerId}_rushing`] = {
                  playerId,
                  playerName,
                  team: teamName,
                  rushingYards: parseInt(athlete.stats[1] || 0),
                  rushingTDs: parseInt(athlete.stats[2] || 0),
                  carries: parseInt(athlete.stats[0] || 0),
                };
              } else if (category === 'receiving' && athlete.stats.length >= 3) {
                stats[`${playerId}_receiving`] = {
                  playerId,
                  playerName,
                  team: teamName,
                  receivingYards: parseInt(athlete.stats[1] || 0),
                  receivingTDs: parseInt(athlete.stats[2] || 0),
                  receptions: parseInt(athlete.stats[0] || 0),
                };
              }
            });
          }
        });
      });
      
      console.log(`📊 Extracted stats for ${Object.keys(stats).length} players`);
    } catch (error) {
      console.error('❌ Error extracting player stats:', error);
    }
    
    return stats;
  }

  private extractLiveGameSituation(espnEvent: ESPNEvent): any {
    const competition = espnEvent.competitions[0];
    const status = competition.status;
    
    // Extract actual ESPN live data
    const quarter = status.period || null;
    const timeRemaining = status.displayClock || null;
    
    // For live games, use real ESPN data, supplement with mock possession data if needed
    if (status.type.name === 'STATUS_IN_PROGRESS') {
      return {
        quarter,
        timeRemaining,
        possession: null, // ESPN doesn't always provide this in scoreboard API
        yardLine: null,
        fieldPosition: null,
        isRedZone: false,
      };
    }
    
    // For final games, return null data
    if (status.type.name === 'STATUS_FINAL') {
      return {
        quarter: null,
        timeRemaining: 'FINAL',
        possession: null,
        yardLine: null,
        fieldPosition: null,
        isRedZone: false,
      };
    }
    
    // For upcoming games, return null
    return {
      quarter: null,
      timeRemaining: null,
      possession: null,
      yardLine: null,
      fieldPosition: null,
      isRedZone: false,
    };
  }

  private getMockLiveSituation(gameId: string, quarter: number | null, timeRemaining: string | null): any {
    // Game-specific mock live situations for development
    const gameMockData: Record<string, any> = {
      'mock-1': { // Thursday - Washington Commanders vs Green Bay Packers  
        quarter: 4,
        timeRemaining: 'FINAL',
        possession: null,
        yardLine: null,
        fieldPosition: null,
        isRedZone: false,
      },
      'mock-2': { // Cowboys vs Giants (LIVE)
        quarter: 2,
        timeRemaining: '8:32',
        possession: 'Dallas Cowboys',
        yardLine: 18,
        fieldPosition: 'opponent',
        isRedZone: true,
      },
      'mock-3': { // Lions vs Bears (upcoming)
        quarter: null,
        timeRemaining: null,
        possession: null,
        yardLine: null,
        fieldPosition: null,
        isRedZone: false,
      },
      'mock-4': { // Ravens vs Browns (LIVE)
        quarter: 3,
        timeRemaining: '11:28',
        possession: 'Baltimore Ravens',
        yardLine: 35,
        fieldPosition: 'own',
        isRedZone: false,
      },
    };
    
    // Use game-specific mock data or fallback to default
    const mockSituation = gameMockData[gameId] || {
      quarter: quarter || 2,
      timeRemaining: timeRemaining || '10:00',
      possession: null, // No possession data for unknown games
      yardLine: null, // No yard line data for unknown games  
      fieldPosition: null,
      isRedZone: false,
    };
    
    // Debug logging to help identify missing game IDs
    if (!gameMockData[gameId]) {
      console.log(`⚠️ No mock live data found for game ID: ${gameId}. Using fallback.`);
    }
    
    return {
      ...mockSituation,
      quarter: quarter || mockSituation.quarter,
      timeRemaining: timeRemaining || mockSituation.timeRemaining,
    };
  }

  async getPlayerStats(gameId: string): Promise<any> {
    const cacheKey = this.getCacheKey('player-stats', { gameId });
    const cached = this.getFromCache<any>(cacheKey);
    
    if (cached) {
      console.log('📦 Returning cached player stats');
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/summary?event=${gameId}`);
      
      if (!response.ok) {
        throw new Error(`ESPN Player Stats API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract player statistics from the response
      const playerStats = this.extractPlayerStats(data);
      
      this.setCache(cacheKey, playerStats, this.LIVE_CACHE_DURATION);
      return playerStats;
    } catch (error) {
      console.error('❌ Failed to fetch player stats from ESPN API:', error);
      return {}; // Return empty object instead of mock data
    }
  }


  private getMockPlayerStats(gameId: string): Record<string, any> {
    // Mock player stats for development - simulate realistic final game stats
    const mockStats: Record<string, any> = {
      // Green Bay Packers vs Washington Commanders (Thursday Week 2)
      'Jordan Love': {
        passingYards: 245,
        rushingYards: 8,
        receivingYards: 0,
      },
      'Josh Jacobs': {
        passingYards: 0,
        rushingYards: 93,
        receivingYards: 12,
      },
      'Jayden Reed': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 78,
      },
      'Christian Watson': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 61,
      },
      'Romeo Doubs': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 52,
      },
      'Tucker Kraft': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 31,
      },
      'Jayden Daniels': {
        passingYards: 210,
        rushingYards: 34,
        receivingYards: 0,
      },
      'Brian Robinson Jr': {
        passingYards: 0,
        rushingYards: 67,
        receivingYards: 8,
      },
      'Terry McLaurin': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 85,
      },
      'Jahan Dotson': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 43,
      },
      'Noah Brown': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 38,
      },
      'Zach Ertz': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 62,
      },
      // Dallas Cowboys vs New York Giants (Live game) - Mid-game stats
      'Dak Prescott': {
        passingYards: 187,
        rushingYards: 12,
        receivingYards: 0,
      },
      'CeeDee Lamb': {
        passingYards: 0,
        rushingYards: 5,
        receivingYards: 92, // Over his 85 line
      },
      'Ezekiel Elliott': {
        passingYards: 0,
        rushingYards: 45,
        receivingYards: 8,
      },
      'Daniel Jones': {
        passingYards: 134,
        rushingYards: 28,
        receivingYards: 0,
      },
      'Malik Nabers': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 67, // Under his 75 line
      },
      'Saquon Barkley': {
        passingYards: 0,
        rushingYards: 38,
        receivingYards: 15,
      },
      // Kansas City Chiefs players
      'Patrick Mahomes': {
        passingYards: 210,
        rushingYards: 12,
        receivingYards: 0,
      },
      'Travis Kelce': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 73,
      },
      'Kareem Hunt': {
        passingYards: 0,
        rushingYards: 61,
        receivingYards: 8,
      },
      // Cleveland Browns vs Baltimore Ravens players
      'DeAndre Hopkins': {
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 73, // 73 yards - over his 50 yard line
      },
      'Derrick Henry': {
        passingYards: 0,
        rushingYards: 84,
        receivingYards: 0, // Show 0 for the screenshot
      },
    };
    
    return mockStats;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🧹 ESPN cache cleared');
  }
}

export const espnApi = new ESPNApiService();
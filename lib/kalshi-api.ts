/**
 * Kalshi API Service
 * 
 * Fetches NFL prediction markets from Kalshi and converts prices to American odds format
 * 
 * SECURITY: All API credentials are stored in environment variables and never hardcoded.
 * The private key is used for RSA-PSS request signing and is never exposed in code.
 */

import { Game } from '@/types';
import { getNFLWeekBoundaries } from './utils';
import crypto from 'crypto';

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_price?: number; // Price in cents (0-100) - may not be present
  no_price?: number; // Price in cents (0-100) - may not be present
  yes_bid?: number; // Bid price in cents
  yes_ask?: number; // Ask price in cents
  no_bid?: number; // Bid price in cents
  no_ask?: number; // Ask price in cents
  last_price?: number; // Last traded price in cents
  last_price_dollars?: string; // Last traded price in dollars
  yes_bid_dollars?: string; // Bid price in dollars
  yes_ask_dollars?: string; // Ask price in dollars
  no_bid_dollars?: string; // Bid price in dollars
  no_ask_dollars?: string; // Ask price in dollars
  status: 'initialized' | 'active' | 'closed' | 'settled' | 'determined';
  close_time: string; // ISO timestamp
  open_time?: string;
  event_ticker?: string;
  series_ticker?: string;
  volume?: number;
  liquidity?: number;
  market_type?: 'binary' | 'scalar';
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

export interface ParsedKalshiMarket extends KalshiMarket {
  marketType?: 'moneyline' | 'spread' | 'over_under';
  teamName?: string;
  opponentName?: string;
  spread?: number;
  total?: number;
  gameDate?: Date;
  yesAmericanOdds?: number;
  noAmericanOdds?: number;
}

class KalshiApiService {
  private baseUrl = process.env.KALSHI_API_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2';
  private apiKeyId: string | null = null;
  private privateKey: string | null = null;

  constructor() {
    // SECURITY: Credentials are loaded from environment variables only
    // Never hardcoded or exposed in the codebase
    this.apiKeyId = process.env.KALSHI_API_KEY_ID || null;
    this.privateKey = process.env.KALSHI_PRIVATE_KEY || null;

    if (!this.apiKeyId || !this.privateKey) {
      console.warn('⚠️ Kalshi API credentials not found. Some features may be limited.');
    }
  }

  /**
   * Sign a request using RSA-PSS with SHA-256
   * SECURITY: Private key is never logged or exposed
   */
  private signRequest(method: string, path: string, timestamp: string): string | null {
    if (!this.privateKey) {
      return null;
    }

    try {
      // Create message string: timestamp + method + path
      const message = `${timestamp}${method}${path}`;

      // Load private key from PEM format
      const key = crypto.createPrivateKey({
        key: this.privateKey,
        format: 'pem',
      });

      // Sign using RSA-PSS with SHA-256
      // Note: Node.js uses RSA_PKCS1_PSS_PADDING for PSS padding
      const signature = crypto.sign(null, Buffer.from(message), {
        key,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
      });

      // Return base64-encoded signature
      return signature.toString('base64');
    } catch (error) {
      console.error('❌ Error signing Kalshi API request:', error);
      return null;
    }
  }

  /**
   * Get authentication headers for Kalshi API requests
   * Returns null if credentials are not available (for unauthenticated requests)
   */
  private getAuthHeaders(method: string, path: string): Record<string, string> | null {
    if (!this.apiKeyId || !this.privateKey) {
      return null; // No authentication available
    }

    const timestamp = Date.now().toString();
    const signature = this.signRequest(method, path, timestamp);

    if (!signature) {
      return null;
    }

    return {
      'KALSHI-ACCESS-KEY': this.apiKeyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature,
    };
  }

  /**
   * Get available sports filters to discover correct sport identifiers
   */
  async getSportsFilters(): Promise<any> {
    try {
      const url = `${this.baseUrl}/search/filters_by_sport`;
      
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      const authHeaders = this.getAuthHeaders('GET', '/search/filters_by_sport');
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      console.log(`🔍 Fetching Kalshi sports filters...`);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched sports filters:`, Object.keys(data.filters_by_sports || {}));
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch sports filters:', error);
      return null;
    }
  }

  /**
   * Discover the correct series ticker for NFL/pro football
   */
  async discoverNFLSeriesTicker(): Promise<string | null> {
    try {
      const filters = await this.getSportsFilters();
      if (!filters || !filters.filters_by_sports) {
        return null;
      }

      // Look for pro football in the sports list
      const sports = Object.keys(filters.filters_by_sports);
      const proFootballKeys = sports.filter(sport => 
        sport.toLowerCase().includes('football') || 
        sport.toLowerCase().includes('nfl') ||
        sport.toLowerCase().includes('pro')
      );

      console.log(`🔍 Found potential pro football sports:`, proFootballKeys);
      
      if (proFootballKeys.length > 0) {
        // Return the first match (most likely "PROFOOTBALL" or similar)
        return proFootballKeys[0];
      }

      // Also check sport_ordering
      if (filters.sport_ordering) {
        const orderedMatch = filters.sport_ordering.find((sport: string) =>
          sport.toLowerCase().includes('football') ||
          sport.toLowerCase().includes('nfl') ||
          sport.toLowerCase().includes('pro')
        );
        if (orderedMatch) {
          console.log(`✅ Found pro football in sport_ordering: ${orderedMatch}`);
          return orderedMatch;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to discover NFL series ticker:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message, error.stack);
      }
      return null;
    }
  }

  /**
   * Get the best available price from a Kalshi market
   * Uses last_price if available, otherwise uses mid-point of bid/ask
   */
  private getMarketPrice(market: KalshiMarket, side: 'yes' | 'no'): number | null {
    // Try last_price first (most accurate)
    if (market.last_price !== undefined && market.last_price !== null) {
      if (side === 'yes') {
        return market.last_price;
      } else {
        // For "no" side, price is 100 - yes_price
        return 100 - market.last_price;
      }
    }
    
    // Try yes_price/no_price fields
    if (side === 'yes' && market.yes_price !== undefined && market.yes_price !== null) {
      return market.yes_price;
    }
    if (side === 'no' && market.no_price !== undefined && market.no_price !== null) {
      return market.no_price;
    }
    
    // Try bid/ask midpoint
    if (side === 'yes' && market.yes_bid !== undefined && market.yes_ask !== undefined) {
      return (market.yes_bid + market.yes_ask) / 2;
    }
    if (side === 'no' && market.no_bid !== undefined && market.no_ask !== undefined) {
      return (market.no_bid + market.no_ask) / 2;
    }
    
    // Try dollar prices
    if (side === 'yes' && market.yes_bid_dollars) {
      const price = parseFloat(market.yes_bid_dollars) * 100;
      if (!isNaN(price)) return price;
    }
    if (side === 'no' && market.no_bid_dollars) {
      const price = parseFloat(market.no_bid_dollars) * 100;
      if (!isNaN(price)) return price;
    }
    
    return null;
  }

  /**
   * Convert Kalshi price (cents, 0-100) to American odds
   * @param price - Price in cents (0-100) representing probability
   * @returns American odds (e.g., +233, -110)
   */
  convertKalshiPriceToAmericanOdds(price: number | null): number {
    if (price === null || price === undefined) {
      return 0;
    }
    
    // Price is in cents, convert to decimal (0.0-1.0)
    const decimalPrice = price / 100;
    
    if (decimalPrice <= 0 || decimalPrice >= 1) {
      // Invalid price
      return 0;
    }

    if (decimalPrice > 0.5) {
      // Favorite: American Odds = (price / (1 - price)) * 100
      const odds = (decimalPrice / (1 - decimalPrice)) * 100;
      return Math.round(odds);
    } else {
      // Underdog: American Odds = -100 / (price / (1 - price))
      const odds = -100 / (decimalPrice / (1 - decimalPrice));
      return Math.round(odds);
    }
  }

  /**
   * Parse market title to extract game information
   * Examples:
   * - "Will Ravens beat Bills?" → moneyline, team: Ravens, opponent: Bills
   * - "Will Ravens win by 3+ points?" → spread, team: Ravens, spread: 3
   * - "Will total points exceed 45.5?" → over_under, total: 45.5
   */
  parseMarketTitle(market: KalshiMarket): Partial<ParsedKalshiMarket> {
    const title = market.title.toLowerCase();
    const subtitle = market.subtitle?.toLowerCase() || '';

    const result: Partial<ParsedKalshiMarket> = {};

    // Team name mappings (common variations)
    const teamPatterns: Record<string, string[]> = {
      'ravens': ['baltimore', 'ravens'],
      'bills': ['buffalo', 'bills'],
      'chiefs': ['kansas city', 'chiefs'],
      'packers': ['green bay', 'packers'],
      'cowboys': ['dallas', 'cowboys'],
      'patriots': ['new england', 'patriots'],
      'jets': ['new york jets', 'jets'],
      'giants': ['new york giants', 'giants'],
      'eagles': ['philadelphia', 'eagles'],
      'steelers': ['pittsburgh', 'steelers'],
      'browns': ['cleveland', 'browns'],
      'bengals': ['cincinnati', 'bengals'],
      'dolphins': ['miami', 'dolphins'],
      'jaguars': ['jacksonville', 'jaguars'],
      'titans': ['tennessee', 'titans'],
      'colts': ['indianapolis', 'colts'],
      'texans': ['houston', 'texans'],
      'broncos': ['denver', 'broncos'],
      'raiders': ['las vegas', 'oakland', 'raiders'],
      'chargers': ['los angeles chargers', 'san diego', 'chargers'],
      'rams': ['los angeles rams', 'rams'],
      '49ers': ['san francisco', '49ers'],
      'seahawks': ['seattle', 'seahawks'],
      'cardinals': ['arizona', 'cardinals'],
      'falcons': ['atlanta', 'falcons'],
      'panthers': ['carolina', 'panthers'],
      'saints': ['new orleans', 'saints'],
      'buccaneers': ['tampa bay', 'buccaneers'],
      'lions': ['detroit', 'lions'],
      'vikings': ['minnesota', 'vikings'],
      'bears': ['chicago', 'bears'],
      'commanders': ['washington', 'commanders', 'redskins'],
    };

    // Also check yes_sub_title and no_sub_title for better parsing
    const yesSubTitle = market.yes_sub_title?.toLowerCase() || '';
    const noSubTitle = market.no_sub_title?.toLowerCase() || '';
    const fullText = `${title} ${subtitle} ${yesSubTitle} ${noSubTitle}`.toLowerCase();
    
    // Check for moneyline pattern: "Will [Team] win?" or "Will [Team] beat [Opponent]?"
    // Also check yes_sub_title which might be cleaner (e.g., "Ravens win" or "Bills win")
    const moneylinePattern = /will\s+([^?]+?)\s+(?:win|beat)/i;
    const moneylineMatch = title.match(moneylinePattern) || yesSubTitle.match(/(\w+)\s+win/i);
    
    if (moneylineMatch || yesSubTitle.includes('win') || noSubTitle.includes('win')) {
      result.marketType = 'moneyline';
      const teamText = moneylineMatch ? moneylineMatch[1].trim() : (yesSubTitle || noSubTitle).split(' ')[0];
      
      // Try to identify team name
      for (const [team, patterns] of Object.entries(teamPatterns)) {
        if (patterns.some(p => teamText.includes(p))) {
          result.teamName = team;
          break;
        }
      }

      // Check for opponent in "beat [Opponent]"
      const beatPattern = /beat\s+([^?]+)/i;
      const beatMatch = title.match(beatPattern);
      if (beatMatch) {
        const opponentText = beatMatch[1].trim();
        for (const [team, patterns] of Object.entries(teamPatterns)) {
          if (patterns.some(p => opponentText.includes(p))) {
            result.opponentName = team;
            break;
          }
        }
      }
    }

    // Check for spread pattern: "Will [Team] win by X+ points?"
    const spreadPattern = /will\s+([^?]+?)\s+win\s+by\s+([\d.]+)\+?\s+points?/i;
    const spreadMatch = title.match(spreadPattern);
    if (spreadMatch) {
      result.marketType = 'spread';
      const teamText = spreadMatch[1].trim();
      const spreadValue = parseFloat(spreadMatch[2]);
      
      for (const [team, patterns] of Object.entries(teamPatterns)) {
        if (patterns.some(p => teamText.includes(p))) {
          result.teamName = team;
          break;
        }
      }
      result.spread = spreadValue;
    }

    // Check for over/under pattern: "Will total points exceed X?" or "Will total be over X?"
    const overUnderPattern = /(?:total\s+points?\s+)?(?:exceed|be\s+over|over)\s+([\d.]+)/i;
    const overUnderMatch = title.match(overUnderPattern);
    if (overUnderMatch) {
      result.marketType = 'over_under';
      result.total = parseFloat(overUnderMatch[1]);
    }

    // Try to extract date from close_time
    if (market.close_time) {
      try {
        result.gameDate = new Date(market.close_time);
      } catch (e) {
        // Invalid date
      }
    }

    return result;
  }

  /**
   * Fetch NFL events (games) from Kalshi API
   * Events represent actual games, then we can get markets for those events
   */
  async fetchNFLEvents(week?: number): Promise<any[]> {
    try {
      // Try without date filters first - Events API might not support those parameters
      const url = new URL(`${this.baseUrl}/events`);
      
      // Filter by series ticker - try "Pro Football" first (from Kalshi website)
      url.searchParams.set('series_ticker', 'Pro Football');
      url.searchParams.set('limit', '1000');
      
      // Don't add date filters initially - Events API might use different parameter names
      // or might not support date filtering at all

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      const authHeaders = this.getAuthHeaders('GET', '/events');
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      console.log(`📡 Fetching Kalshi NFL events${week ? ` for Week ${week}` : ''}...`);
      console.log(`🔗 Events URL: ${url.toString()}`);
      const response = await fetch(url.toString(), { headers });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.warn(`⚠️ Events API rate limited (429). Retry after: ${retryAfter || 'unknown'} seconds`);
        return []; // Return empty array instead of throwing
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Events API error: ${response.status} ${response.statusText}`);
        console.error(`❌ Error response: ${errorText}`);
        console.error(`❌ Request URL: ${url.toString()}`);
        console.error(`❌ Request headers:`, Object.keys(headers));
        
        // Try without series_ticker to see if that's the issue
        if (response.status === 400) {
          console.log(`🔄 Trying Events API without series_ticker filter...`);
          const url2 = new URL(`${this.baseUrl}/events`);
          url2.searchParams.set('limit', '10'); // Small limit for testing
          const response2 = await fetch(url2.toString(), { headers });
          if (response2.ok) {
            const data2 = await response2.json();
            console.log(`✅ Events API works without series_ticker. Found ${data2.events?.length || 0} events`);
            return data2.events || [];
          } else {
            const errorText2 = await response2.text();
            console.error(`❌ Events API still fails without series_ticker: ${response2.status} - ${errorText2}`);
          }
        }
        
        // Don't throw - return empty array so we can continue testing
        return [];
      }

      const responseText = await response.text();
      console.log(`📥 Events API raw response (first 1000 chars): ${responseText.substring(0, 1000)}`);
      
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ Failed to parse Events API JSON:`, parseError);
        console.error(`❌ Full response: ${responseText}`);
        return [];
      }
      
      console.log(`✅ Events API response structure:`, Object.keys(data));
      console.log(`✅ Fetched ${data.events?.length || 0} NFL events`);
      
      if (data.events && data.events.length > 0) {
        console.log(`📊 Sample events:`, data.events.slice(0, 3).map((e: any) => ({
          ticker: e.ticker,
          title: e.title,
          expected_expiration_time: e.expected_expiration_time,
        })));
      }
      
      return data.events || [];
    } catch (error) {
      console.error('❌ Failed to fetch Kalshi events:', error);
      return [];
    }
  }

  /**
   * Fetch NFL markets from Kalshi API
   * @param week - Optional NFL week number (1-18)
   * @returns Array of Kalshi markets
   */
  async fetchNFLMarkets(week?: number): Promise<KalshiMarket[]> {
    try {
      // Try multiple approaches to find NFL markets
      const allMarkets: KalshiMarket[] = [];
      
      // First, discover the correct series ticker for pro football
      const nflSeriesTicker = await this.discoverNFLSeriesTicker();
      // Based on Kalshi website, try "Pro Football" variations first
      const seriesTickersToTry = nflSeriesTicker 
        ? [nflSeriesTicker, 'Pro Football', 'PROFOOTBALL', 'PRO-FOOTBALL', 'NFL', 'Football']
        : ['Pro Football', 'PROFOOTBALL', 'PRO-FOOTBALL', 'NFL', 'Football'];
      
      console.log(`🔍 Trying series tickers: ${seriesTickersToTry.join(', ')}`);

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      // SECURITY: Add authentication headers if credentials are available
      const authHeaders = this.getAuthHeaders('GET', '/markets');
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      // Strategy: Always fetch ALL active markets first (no date filter), then filter client-side
      // This helps us see what markets actually exist and what dates they have
      for (const seriesTicker of seriesTickersToTry) {
        // Try multiple status values - Kalshi might use different statuses
        const statusesToTry = ['active', 'open', undefined]; // Try with and without status filter
        
        for (const status of statusesToTry) {
          const url1 = new URL(`${this.baseUrl}/markets`);
          url1.searchParams.set('series_ticker', seriesTicker);
          if (status) {
            url1.searchParams.set('status', status);
          }
          url1.searchParams.set('limit', '1000');
          // NO DATE FILTERING - fetch all markets
          
          console.log(`📡 Fetching markets for series_ticker=${seriesTicker}, status=${status || 'none'}...`);
          console.log(`🔗 URL: ${url1.toString()}`);
          
          const response1 = await fetch(url1.toString(), { headers });
          
          // Handle rate limiting
          if (response1.status === 429) {
            const retryAfter = response1.headers.get('Retry-After');
            console.warn(`⚠️ Rate limited (429). Retry after: ${retryAfter || 'unknown'} seconds`);
            console.warn(`⚠️ URL that hit rate limit: ${url1.toString()}`);
            // Don't throw - just log and continue to next status/ticker
            continue;
          }
          
          if (response1.ok) {
            const responseText = await response1.text();
            console.log(`📥 Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
            
            let data1: KalshiMarketsResponse;
            try {
              data1 = JSON.parse(responseText);
            } catch (parseError) {
              console.error(`❌ Failed to parse JSON response:`, parseError);
              console.error(`❌ Response text:`, responseText);
              continue; // Try next status
            }
            
            console.log(`✅ series_ticker=${seriesTicker}, status=${status || 'none'}: Fetched ${data1.markets?.length || 0} markets`);
            
            // Log response structure if no markets
            if (!data1.markets || data1.markets.length === 0) {
              console.warn(`⚠️ No markets returned. Response structure:`, Object.keys(data1));
              console.warn(`⚠️ Full response:`, JSON.stringify(data1).substring(0, 1000));
            }
          
            if (data1.markets.length > 0) {
              // Log date range of available markets for debugging
              const marketsWithDates = data1.markets.filter(m => m.close_time);
              if (marketsWithDates.length > 0) {
                const dates = marketsWithDates.map(m => new Date(m.close_time!));
                const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                console.log(`📅 Available market dates: ${minDate.toISOString()} to ${maxDate.toISOString()}`);
                console.log(`📅 Sample close times:`, dates.slice(0, 5).map(d => d.toISOString()));
              }
              
              // Log sample markets for debugging
              console.log(`📊 Sample markets from ${seriesTicker}:`, data1.markets.slice(0, 5).map(m => ({
                ticker: m.ticker,
                title: m.title,
                close_time: m.close_time,
                status: m.status,
                event_ticker: m.event_ticker,
              })));
              
              // If week specified, filter client-side
              if (week !== undefined) {
                const { start, end } = getNFLWeekBoundaries(week, 2025);
                const extendedEnd = new Date(end);
                extendedEnd.setDate(extendedEnd.getDate() + 2); // Include 2 days after week ends
                
                console.log(`📅 Filtering for Week ${week}: ${start.toISOString()} to ${extendedEnd.toISOString()}`);
                
                const weekMarkets = data1.markets.filter(m => {
                  if (!m.close_time) return false;
                  const closeTime = new Date(m.close_time).getTime();
                  const inRange = closeTime >= start.getTime() && closeTime <= extendedEnd.getTime();
                  if (inRange) {
                    console.log(`✅ Market matches week: ${m.title} (closes ${m.close_time})`);
                  }
                  return inRange;
                });
                
                console.log(`📅 Filtered to ${weekMarkets.length} markets within Week ${week} date range`);
                
                if (weekMarkets.length > 0) {
                  allMarkets.push(...weekMarkets);
                  return allMarkets; // Found markets, return immediately
                } else {
                  console.warn(`⚠️ No markets found for Week ${week} in ${seriesTicker}. Available dates shown above.`);
                  // Still add all markets to see what's available (for debugging)
                  allMarkets.push(...data1.markets);
                  return allMarkets;
                }
              } else {
                // No week filter - return all markets
                console.log(`📊 No week filter - returning all ${data1.markets.length} markets`);
                allMarkets.push(...data1.markets);
                return allMarkets; // Found markets, return immediately
              }
            }
          } else {
            const errorText = await response1.text();
            console.warn(`⚠️ series_ticker=${seriesTicker}, status=${status || 'none'} failed: ${response1.status} ${response1.statusText}`);
            if (errorText) {
              console.warn(`⚠️ Error response:`, errorText.substring(0, 500));
            }
          }
        }
      }
      
      // Approach 3: Try without series filter, then filter by title keywords
      if (allMarkets.length === 0) {
        console.log(`🔄 Trying Approach 3: Fetch all active markets and filter by NFL keywords...`);
        const url3 = new URL(`${this.baseUrl}/markets`);
        url3.searchParams.set('status', 'active');
        url3.searchParams.set('limit', '1000');
        
        // Don't filter by date - get all and filter client-side

        const response3 = await fetch(url3.toString(), { headers });
        
        if (response3.ok) {
          const data3: KalshiMarketsResponse = await response3.json();
          console.log(`✅ Approach 3: Fetched ${data3.markets.length} total markets`);
          
          // Log all unique series_tickers found for debugging
          const uniqueSeries = [...new Set(data3.markets.map(m => m.series_ticker).filter(Boolean))];
          console.log(`📊 Found series_tickers in results:`, uniqueSeries);
          
          // Filter for NFL-related markets by checking titles and series_tickers
          const nflKeywords = ['nfl', 'football', 'ravens', 'bills', 'chiefs', 'packers', 'cowboys', 
            'patriots', 'jets', 'giants', 'eagles', 'steelers', 'browns', 'bengals', 'dolphins',
            'jaguars', 'titans', 'colts', 'texans', 'broncos', 'raiders', 'chargers', 'rams',
            '49ers', 'seahawks', 'cardinals', 'falcons', 'panthers', 'saints', 'buccaneers',
            'lions', 'vikings', 'bears', 'commanders'];
          
          let nflMarkets = data3.markets.filter(m => {
            // Check series_ticker first
            if (m.series_ticker) {
              const seriesLower = m.series_ticker.toLowerCase();
              if (seriesLower.includes('football') || seriesLower.includes('nfl') || seriesLower.includes('pro')) {
                return true;
              }
            }
            
            // Then check titles
            const titleLower = (m.title || '').toLowerCase();
            const subtitleLower = (m.subtitle || '').toLowerCase();
            return nflKeywords.some(keyword => 
              titleLower.includes(keyword) || subtitleLower.includes(keyword)
            );
          });
          
          // If week specified, also filter by date
          if (week) {
            const { start, end } = getNFLWeekBoundaries(week, 2025);
            const extendedEnd = new Date(end);
            extendedEnd.setDate(extendedEnd.getDate() + 2);
            
            nflMarkets = nflMarkets.filter(m => {
              if (!m.close_time) return false;
              const closeTime = new Date(m.close_time).getTime();
              return closeTime >= start.getTime() && closeTime <= extendedEnd.getTime();
            });
            
            console.log(`📅 Filtered to ${nflMarkets.length} NFL markets within Week ${week} date range`);
          }
          
          console.log(`✅ Filtered to ${nflMarkets.length} NFL-related markets`);
          allMarkets.push(...nflMarkets);
        } else {
          const errorText = await response3.text();
          console.warn(`⚠️ Approach 3 failed: ${response3.status} ${response3.statusText}`, errorText);
        }
      }

      // Remove duplicates by ticker
      const uniqueMarkets = Array.from(
        new Map(allMarkets.map(m => [m.ticker, m])).values()
      );

      console.log(`✅ Total unique Kalshi NFL markets: ${uniqueMarkets.length}`);
      
      if (uniqueMarkets.length === 0) {
        console.warn(`⚠️ No NFL markets found. This could mean:
          - No markets are currently open for this week
          - The series_ticker is incorrect (tried: ${seriesTickersToTry.join(', ')})
          - Markets use a different naming convention
          - Authentication is required for this data
          - Markets are closed or not yet available`);
        
        // Try one more thing: fetch without any filters to see what's available
        console.log(`🔄 Attempting to fetch ANY open markets to see what's available...`);
        const urlAny = new URL(`${this.baseUrl}/markets`);
        urlAny.searchParams.set('status', 'open');
        urlAny.searchParams.set('limit', '100');
        
        try {
          const responseAny = await fetch(urlAny.toString(), { headers });
          if (responseAny.ok) {
            const dataAny: KalshiMarketsResponse = await responseAny.json();
            const uniqueSeries = [...new Set(dataAny.markets.map(m => m.series_ticker).filter(Boolean))];
            console.log(`📊 Found ${dataAny.markets.length} total open markets with series_tickers:`, uniqueSeries);
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch sample markets:', e);
        }
      }

      return uniqueMarkets;
    } catch (error) {
      console.error('❌ Failed to fetch Kalshi markets:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message, error.stack);
      }
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Get a specific market by ticker
   */
  async getMarket(ticker: string): Promise<KalshiMarket | null> {
    try {
      const url = `${this.baseUrl}/markets/${ticker}`;
      
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      // SECURITY: Add authentication headers if credentials are available
      const authHeaders = this.getAuthHeaders('GET', `/markets/${ticker}`);
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
      }

      const data: { market: KalshiMarket } = await response.json();
      return data.market;
    } catch (error) {
      console.error(`❌ Failed to fetch Kalshi market ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Filter out non-game markets (mention markets, etc.)
   */
  private isGameMarket(market: KalshiMarket): boolean {
    const title = (market.title || '').toLowerCase();
    const subtitle = (market.subtitle || '').toLowerCase();
    const yesSubTitle = (market.yes_sub_title || '').toLowerCase();
    const noSubTitle = (market.no_sub_title || '').toLowerCase();
    
    // Exclude mention markets
    if (title.includes('what will') && (title.includes('say') || title.includes('mention'))) {
      return false;
    }
    
    // Exclude markets with "MENTION" in ticker
    if (market.ticker.includes('MENTION')) {
      return false;
    }
    
    // Look for actual game outcome markets
    // These typically have patterns like:
    // - "Will [Team] win?"
    // - "Will [Team] beat [Opponent]?"
    // - "Will [Team] win by X+ points?"
    // - "Will total points exceed X?"
    
    const gameOutcomePatterns = [
      /will\s+.*\s+win/i,
      /will\s+.*\s+beat/i,
      /will\s+.*\s+points/i,
      /total\s+points/i,
      /over\s+\d+/i,
      /under\s+\d+/i,
    ];
    
    const hasGamePattern = gameOutcomePatterns.some(pattern => 
      pattern.test(title) || pattern.test(subtitle) || 
      pattern.test(yesSubTitle) || pattern.test(noSubTitle)
    );
    
    // Also check for team names in title (strong indicator of game market)
    const teamKeywords = ['ravens', 'bills', 'chiefs', 'packers', 'cowboys', 'patriots', 
      'jets', 'giants', 'eagles', 'steelers', 'browns', 'bengals', 'dolphins',
      'jaguars', 'titans', 'colts', 'texans', 'broncos', 'raiders', 'chargers', 'rams',
      '49ers', 'seahawks', 'cardinals', 'falcons', 'panthers', 'saints', 'buccaneers',
      'lions', 'vikings', 'bears', 'commanders', 'minnesota', 'dallas', 'buffalo',
      'kansas city', 'green bay', 'new england', 'new york', 'philadelphia', 'pittsburgh'];
    
    const hasTeamName = teamKeywords.some(team => 
      title.includes(team) || subtitle.includes(team) ||
      yesSubTitle.includes(team) || noSubTitle.includes(team)
    );
    
    return hasGamePattern || hasTeamName;
  }

  /**
   * Process and enrich markets with parsed data and converted odds
   */
  processMarkets(markets: KalshiMarket[]): ParsedKalshiMarket[] {
    // Filter to only game-related markets
    const gameMarkets = markets.filter(m => this.isGameMarket(m));
    console.log(`🎯 Filtered ${markets.length} markets → ${gameMarkets.length} game markets`);
    
    return gameMarkets.map(market => {
      const parsed = this.parseMarketTitle(market);
      
      // Get prices using the best available method
      const yesPrice = this.getMarketPrice(market, 'yes');
      const noPrice = this.getMarketPrice(market, 'no');
      
      const yesOdds = this.convertKalshiPriceToAmericanOdds(yesPrice);
      const noOdds = this.convertKalshiPriceToAmericanOdds(noPrice);

      return {
        ...market,
        ...parsed,
        yesAmericanOdds: yesOdds,
        noAmericanOdds: noOdds,
      };
    });
  }
}

export const kalshiApi = new KalshiApiService();

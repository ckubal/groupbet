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
  yes_price: number; // Price in cents (0-100)
  no_price: number; // Price in cents (0-100)
  status: 'unopened' | 'open' | 'closed' | 'settled';
  close_time: string; // ISO timestamp
  open_time?: string;
  event_ticker?: string;
  series_ticker?: string;
  volume?: number;
  liquidity?: number;
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
   * Convert Kalshi price (cents, 0-100) to American odds
   * @param price - Price in cents (0-100) representing probability
   * @returns American odds (e.g., +233, -110)
   */
  convertKalshiPriceToAmericanOdds(price: number): number {
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

    // Check for moneyline pattern: "Will [Team] win?" or "Will [Team] beat [Opponent]?"
    const moneylinePattern = /will\s+([^?]+?)\s+(?:win|beat)/i;
    const moneylineMatch = title.match(moneylinePattern);
    if (moneylineMatch) {
      result.marketType = 'moneyline';
      const teamText = moneylineMatch[1].trim();
      
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
      const seriesTickersToTry = nflSeriesTicker 
        ? [nflSeriesTicker, 'NFL', 'PROFOOTBALL', 'PRO-FOOTBALL']
        : ['PROFOOTBALL', 'PRO-FOOTBALL', 'NFL', 'FOOTBALL'];
      
      console.log(`🔍 Trying series tickers: ${seriesTickersToTry.join(', ')}`);

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      // SECURITY: Add authentication headers if credentials are available
      const authHeaders = this.getAuthHeaders('GET', '/markets');
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      // Approach 1: Try each discovered series ticker
      for (const seriesTicker of seriesTickersToTry) {
        const url1 = new URL(`${this.baseUrl}/markets`);
        url1.searchParams.set('series_ticker', seriesTicker);
        url1.searchParams.set('status', 'open');
        url1.searchParams.set('limit', '1000');
        
        if (week) {
          const { start, end } = getNFLWeekBoundaries(week, 2025);
          url1.searchParams.set('min_close_ts', Math.floor(start.getTime() / 1000).toString());
          url1.searchParams.set('max_close_ts', Math.floor(end.getTime() / 1000).toString());
        }

        console.log(`📡 Trying series_ticker=${seriesTicker}${week ? ` for Week ${week}` : ''}...`);
        console.log(`🔗 URL: ${url1.toString()}`);
        
        const response1 = await fetch(url1.toString(), { headers });
        
        if (response1.ok) {
          const data1: KalshiMarketsResponse = await response1.json();
          console.log(`✅ series_ticker=${seriesTicker}: Fetched ${data1.markets.length} markets`);
          
          if (data1.markets.length > 0) {
            allMarkets.push(...data1.markets);
            
            // Log sample markets for debugging
            console.log(`📊 Sample markets from ${seriesTicker}:`, data1.markets.slice(0, 3).map(m => ({
              ticker: m.ticker,
              title: m.title,
              series_ticker: m.series_ticker,
              event_ticker: m.event_ticker,
              close_time: m.close_time,
            })));
            
            // If we found markets, we can stop trying other tickers
            break;
          }
        } else {
          const errorText = await response1.text();
          console.warn(`⚠️ series_ticker=${seriesTicker} failed: ${response1.status} ${response1.statusText}`);
        }
      }

      // Approach 2: Try without series filter, then filter by title keywords
      if (allMarkets.length === 0) {
        console.log(`🔄 Trying Approach 2: Fetch all open markets and filter by NFL keywords...`);
        const url2 = new URL(`${this.baseUrl}/markets`);
        url2.searchParams.set('status', 'open');
        url2.searchParams.set('limit', '1000');
        
        if (week) {
          const { start, end } = getNFLWeekBoundaries(week, 2025);
          url2.searchParams.set('min_close_ts', Math.floor(start.getTime() / 1000).toString());
          url2.searchParams.set('max_close_ts', Math.floor(end.getTime() / 1000).toString());
        }

        const response2 = await fetch(url2.toString(), { headers });
        
        if (response2.ok) {
          const data2: KalshiMarketsResponse = await response2.json();
          console.log(`✅ Approach 2: Fetched ${data2.markets.length} total markets`);
          
          // Log all unique series_tickers found for debugging
          const uniqueSeries = [...new Set(data2.markets.map(m => m.series_ticker).filter(Boolean))];
          console.log(`📊 Found series_tickers in results:`, uniqueSeries);
          
          // Filter for NFL-related markets by checking titles and series_tickers
          const nflKeywords = ['nfl', 'football', 'ravens', 'bills', 'chiefs', 'packers', 'cowboys', 
            'patriots', 'jets', 'giants', 'eagles', 'steelers', 'browns', 'bengals', 'dolphins',
            'jaguars', 'titans', 'colts', 'texans', 'broncos', 'raiders', 'chargers', 'rams',
            '49ers', 'seahawks', 'cardinals', 'falcons', 'panthers', 'saints', 'buccaneers',
            'lions', 'vikings', 'bears', 'commanders'];
          
          const nflMarkets = data2.markets.filter(m => {
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
          
          console.log(`✅ Filtered to ${nflMarkets.length} NFL-related markets`);
          allMarkets.push(...nflMarkets);
        } else {
          const errorText = await response2.text();
          console.warn(`⚠️ Approach 2 failed: ${response2.status} ${response2.statusText}`, errorText);
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
   * Process and enrich markets with parsed data and converted odds
   */
  processMarkets(markets: KalshiMarket[]): ParsedKalshiMarket[] {
    return markets.map(market => {
      const parsed = this.parseMarketTitle(market);
      const yesOdds = this.convertKalshiPriceToAmericanOdds(market.yes_price);
      const noOdds = this.convertKalshiPriceToAmericanOdds(market.no_price);

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

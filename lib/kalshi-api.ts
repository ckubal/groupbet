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
      const url = new URL(`${this.baseUrl}/markets`);
      
      // Filter by NFL series
      url.searchParams.set('series_ticker', 'NFL');
      url.searchParams.set('status', 'open'); // Only get open markets
      url.searchParams.set('limit', '1000'); // Max limit

      // If week is specified, filter by date range
      if (week) {
        const { start, end } = getNFLWeekBoundaries(week, 2025);
        // Kalshi uses Unix timestamps
        url.searchParams.set('min_close_ts', Math.floor(start.getTime() / 1000).toString());
        url.searchParams.set('max_close_ts', Math.floor(end.getTime() / 1000).toString());
      }

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      // SECURITY: Add authentication headers if credentials are available
      // Private key is used for signing, never sent directly
      const authHeaders = this.getAuthHeaders('GET', '/markets');
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      console.log(`📡 Fetching Kalshi NFL markets${week ? ` for Week ${week}` : ''}...`);
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
      }

      const data: KalshiMarketsResponse = await response.json();
      console.log(`✅ Fetched ${data.markets.length} Kalshi markets`);

      return data.markets;
    } catch (error) {
      console.error('❌ Failed to fetch Kalshi markets:', error);
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

import { NextRequest, NextResponse } from 'next/server';
import { kalshiApi } from '@/lib/kalshi-api';
import { matchKalshiMarketsToGames } from '@/lib/kalshi-game-matcher';
import { compareMoneyline, compareSpread, compareOverUnder, compareLines } from '@/lib/price-comparison';
import { detectMoneylineArbitrage } from '@/lib/arbitrage-detector';
import { oddsApi } from '@/lib/odds-api';
import { getCurrentNFLWeek } from '@/lib/utils';

export interface ComparisonResult {
  game: {
    id: string;
    awayTeam: string;
    homeTeam: string;
    gameTime: string;
  };
  moneylines: Array<{
    kalshi?: {
      yesOdds: number;
      noOdds: number;
      teamName?: string;
    };
    bovada?: {
      homeOdds: number;
      awayOdds: number;
    };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    priceDifference: number;
    valueBet?: {
      platform: 'kalshi' | 'bovada';
      expectedValue: number;
      recommendation: string;
    };
  }>;
  spreads: Array<{
    kalshi?: {
      line: number;
      odds: number;
    };
    bovada?: {
      line: number;
      odds: number;
    };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    lineDifference: number;
    priceDifference: number;
  }>;
  overUnders: Array<{
    kalshi?: {
      line: number;
      overOdds: number;
      underOdds: number;
    };
    bovada?: {
      line: number;
      overOdds: number;
      underOdds: number;
    };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    lineDifference: number;
    priceDifference: number;
  }>;
  arbitrageOpportunities: Array<{
    marketType: string;
    profitMargin: number;
    guaranteedProfit: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    if (weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }

    console.log(`🔄 Comparing Kalshi vs Bovada for Week ${weekNumber}...`);

    // Fetch games and Kalshi markets
    const [games, kalshiMarkets] = await Promise.all([
      oddsApi.getNFLGames(weekNumber),
      kalshiApi.fetchNFLMarkets(weekNumber),
    ]);

    console.log(`📊 Loaded ${games.length} games and ${kalshiMarkets.length} Kalshi markets`);

    // Process and match markets
    const processedMarkets = kalshiApi.processMarkets(kalshiMarkets);
    console.log(`🔍 Processed ${processedMarkets.length} markets, attempting to match with ${games.length} games...`);
    
    // Log sample processed markets for debugging
    if (processedMarkets.length > 0) {
      console.log(`📋 Sample processed markets:`, processedMarkets.slice(0, 3).map(m => ({
        ticker: m.ticker,
        title: m.title,
        marketType: m.marketType,
        teamName: m.teamName,
        opponentName: m.opponentName,
        spread: m.spread,
        total: m.total,
        gameDate: m.gameDate,
      })));
    }
    
    const matchedGroups = matchKalshiMarketsToGames(processedMarkets, games);
    console.log(`✅ Matched ${matchedGroups.length} game groups with Kalshi markets`);

    // Build comparison results
    const comparisons: ComparisonResult[] = [];

    for (const group of matchedGroups) {
      const { game, markets } = group;
      
      const moneylines = markets.filter(m => m.marketType === 'moneyline');
      const spreads = markets.filter(m => m.marketType === 'spread');
      const overUnders = markets.filter(m => m.marketType === 'over_under');

      const comparison: ComparisonResult = {
        game: {
          id: game.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          gameTime: typeof game.gameTime === 'string' 
            ? game.gameTime 
            : game.gameTime.toISOString(),
        },
        moneylines: [],
        spreads: [],
        overUnders: [],
        arbitrageOpportunities: [],
      };

      // Compare moneylines
      if (moneylines.length > 0 && game.homeMoneyline && game.awayMoneyline) {
        const moneylineComparisons = compareMoneyline(
          moneylines[0],
          game.homeMoneyline,
          game.awayMoneyline,
          game
        );
        
        for (const comp of moneylineComparisons) {
          comparison.moneylines.push({
            kalshi: comp.kalshiMarket ? {
              yesOdds: comp.kalshiMarket.yesAmericanOdds || 0,
              noOdds: comp.kalshiMarket.noAmericanOdds || 0,
              teamName: comp.kalshiMarket.teamName,
            } : undefined,
            bovada: {
              homeOdds: game.homeMoneyline,
              awayOdds: game.awayMoneyline,
            },
            betterPlatform: comp.betterPlatform,
            priceDifference: comp.priceDifference,
            valueBet: comp.valueBet,
          });
        }

        // Check for arbitrage
        const arbitrageOpps = detectMoneylineArbitrage(
          moneylines[0],
          game.homeMoneyline,
          game.awayMoneyline,
          game
        );
        
        for (const opp of arbitrageOpps) {
          comparison.arbitrageOpportunities.push({
            marketType: 'moneyline',
            profitMargin: opp.profitMargin,
            guaranteedProfit: opp.guaranteedProfit,
          });
        }
      }

      // Compare spreads
      if (spreads.length > 0 && game.spread !== undefined && game.spreadOdds) {
        const spreadComp = compareSpread(
          spreads[0],
          game.spread,
          game.spreadOdds,
          game
        );
        
        comparison.spreads.push({
          kalshi: spreadComp.kalshiMarket ? {
            line: spreadComp.kalshiMarket.spread || 0,
            odds: spreadComp.kalshiMarket.yesAmericanOdds || 0,
          } : undefined,
          bovada: {
            line: game.spread,
            odds: game.spreadOdds,
          },
          betterPlatform: spreadComp.betterPlatform,
          lineDifference: spreadComp.kalshiLine && game.spread 
            ? spreadComp.kalshiLine - game.spread 
            : 0,
          priceDifference: spreadComp.priceDifference,
        });
      }

      // Compare over/unders
      if (overUnders.length > 0 && game.overUnder !== undefined) {
        const overUnderComps = compareOverUnder(
          overUnders[0],
          game.overUnder,
          game.overUnderOdds, // Using same odds for over/under (simplified)
          game.overUnderOdds,
          game
        );
        
        for (const comp of overUnderComps) {
          comparison.overUnders.push({
            kalshi: comp.kalshiMarket ? {
              line: comp.kalshiMarket.total || 0,
              overOdds: comp.kalshiMarket.yesAmericanOdds || 0,
              underOdds: comp.kalshiMarket.noAmericanOdds || 0,
            } : undefined,
            bovada: {
              line: game.overUnder,
              overOdds: game.overUnderOdds || 0,
              underOdds: game.overUnderOdds || 0, // Simplified - would need separate over/under odds
            },
            betterPlatform: comp.betterPlatform,
            lineDifference: comp.kalshiLine && game.overUnder 
              ? comp.kalshiLine - game.overUnder 
              : 0,
            priceDifference: comp.priceDifference,
          });
        }
      }

      comparisons.push(comparison);
    }

    console.log(`✅ Generated ${comparisons.length} comparisons`);

    return NextResponse.json({
      success: true,
      week: weekNumber,
      comparisons,
      totalGames: games.length,
      matchedGames: matchedGroups.length,
    });
  } catch (error) {
    console.error('❌ Error comparing Kalshi vs Bovada:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to compare markets',
      success: false
    }, { status: 500 });
  }
}

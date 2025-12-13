import { NextRequest, NextResponse } from 'next/server';
import { kalshiApi } from '@/lib/kalshi-api';
import { matchKalshiMarketsToGames } from '@/lib/kalshi-game-matcher';
import { detectMoneylineArbitrage, findBestArbitrageOpportunities } from '@/lib/arbitrage-detector';
import { oddsApi } from '@/lib/odds-api';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const minProfit = searchParams.get('minProfit');
    
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    const minProfitPercent = minProfit ? parseFloat(minProfit) : 0.5;
    
    if (weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }

    console.log(`💰 Finding arbitrage opportunities for Week ${weekNumber} (min profit: ${minProfitPercent}%)...`);

    // Fetch games and Kalshi markets
    const [games, kalshiMarkets] = await Promise.all([
      oddsApi.getNFLGames(weekNumber),
      kalshiApi.fetchNFLMarkets(weekNumber),
    ]);

    // Process and match markets
    const processedMarkets = kalshiApi.processMarkets(kalshiMarkets);
    const matchedGroups = matchKalshiMarketsToGames(processedMarkets, games);

    // Find arbitrage opportunities
    const allOpportunities = [];

    for (const group of matchedGroups) {
      const { game, markets } = group;
      
      const moneylines = markets.filter(m => m.marketType === 'moneyline');
      
      if (moneylines.length > 0 && game.homeMoneyline && game.awayMoneyline) {
        const arbitrageOpps = detectMoneylineArbitrage(
          moneylines[0],
          game.homeMoneyline,
          game.awayMoneyline,
          game
        );
        
        allOpportunities.push(...arbitrageOpps);
      }
    }

    // Filter and rank opportunities
    const filteredOpportunities = allOpportunities.filter(
      opp => opp.profitMargin >= minProfitPercent
    );
    const bestOpportunities = findBestArbitrageOpportunities(filteredOpportunities);

    console.log(`✅ Found ${bestOpportunities.length} arbitrage opportunities`);

    return NextResponse.json({
      success: true,
      week: weekNumber,
      minProfitPercent,
      opportunities: bestOpportunities.map(opp => ({
        game: {
          id: opp.game.id,
          awayTeam: opp.game.awayTeam,
          homeTeam: opp.game.homeTeam,
          gameTime: typeof opp.game.gameTime === 'string' 
            ? opp.game.gameTime 
            : opp.game.gameTime.toISOString(),
        },
        marketType: opp.marketType,
        kalshiSide: opp.kalshiSide,
        bovadaSide: opp.bovadaSide,
        kalshiOdds: opp.kalshiSide === 'yes' 
          ? opp.kalshiMarket.yesAmericanOdds 
          : opp.kalshiMarket.noAmericanOdds,
        bovadaOdds: opp.bovadaOdds,
        profitMargin: opp.profitMargin,
        totalStake: opp.totalStake,
        kalshiStake: opp.kalshiStake,
        bovadaStake: opp.bovadaStake,
        guaranteedReturn: opp.guaranteedReturn,
        guaranteedProfit: opp.guaranteedProfit,
      })),
      count: bestOpportunities.length,
    });
  } catch (error) {
    console.error('❌ Error finding arbitrage opportunities:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to find arbitrage opportunities',
      success: false
    }, { status: 500 });
  }
}

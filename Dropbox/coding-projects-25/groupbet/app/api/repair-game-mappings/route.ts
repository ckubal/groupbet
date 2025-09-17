import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { week = 3, season = 2025, dryRun = false } = await request.json();
    
    console.log(`🔧 ${dryRun ? 'Testing' : 'Running'} game mapping repair for Week ${week}, ${season}...`);
    
    // Import the enhanced service
    const { EnhancedGameService } = await import('@/lib/enhanced-game-service');
    
    if (dryRun) {
      // Just validate mappings without making changes
      const games = await EnhancedGameService.loadGamesWithRobustMatching(week, season, true);
      
      let validMappings = 0;
      let invalidMappings = 0;
      const issues: Array<{ gameId: string; teams: string; issues: string[] }> = [];
      
      for (const game of games) {
        const result = await EnhancedGameService.validateAndRepairGameMapping(game, [], []);
        
        if (result.issues.length === 0) {
          validMappings++;
        } else {
          invalidMappings++;
          issues.push({
            gameId: game.id,
            teams: `${game.awayTeam} @ ${game.homeTeam}`,
            issues: result.issues
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        week,
        season,
        totalGames: games.length,
        validMappings,
        invalidMappings,
        issues,
        message: `Dry run complete: ${validMappings}/${games.length} games have valid mappings`
      });
      
    } else {
      // Actually repair the mappings
      const result = await EnhancedGameService.repairAllGameMappings(week);
      
      return NextResponse.json({
        success: true,
        week,
        season,
        ...result,
        message: `Repair complete: ${result.repaired} repaired, ${result.failed} failed`
      });
    }
    
  } catch (error) {
    console.error('❌ Game mapping repair failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '3');
    
    console.log(`📊 Checking game mapping health for Week ${week}...`);
    
    // Import services
    const { gameIdMappingService } = await import('@/lib/firebase-service');
    const { oddsApi } = await import('@/lib/odds-api');
    
    // Load current games
    const games = await oddsApi.getNFLGames(week);
    
    let healthyMappings = 0;
    let missingESPN = 0;
    let missingOdds = 0;
    const healthReport: Array<{
      gameId: string;
      teams: string;
      espnId?: string;
      oddsApiId?: string;
      status: 'healthy' | 'missing_espn' | 'missing_odds' | 'missing_both';
    }> = [];
    
    for (const game of games) {
      const mapping = await gameIdMappingService.getGameMapping(game.id);
      
      let status: 'healthy' | 'missing_espn' | 'missing_odds' | 'missing_both' = 'healthy';
      
      if (!mapping?.espnId && !mapping?.oddsApiId) {
        status = 'missing_both';
        missingESPN++;
        missingOdds++;
      } else if (!mapping?.espnId) {
        status = 'missing_espn';
        missingESPN++;
      } else if (!mapping?.oddsApiId) {
        status = 'missing_odds';
        missingOdds++;
      } else {
        healthyMappings++;
      }
      
      healthReport.push({
        gameId: game.id,
        teams: `${game.awayTeam} @ ${game.homeTeam}`,
        espnId: mapping?.espnId,
        oddsApiId: mapping?.oddsApiId,
        status
      });
    }
    
    return NextResponse.json({
      success: true,
      week,
      totalGames: games.length,
      healthyMappings,
      missingESPN,
      missingOdds,
      healthScore: Math.round((healthyMappings / games.length) * 100),
      healthReport,
      recommendations: [
        ...(missingOdds > 0 ? [`Run repair for ${missingOdds} games missing Odds API mappings`] : []),
        ...(missingESPN > 0 ? [`Consider ESPN API integration for ${missingESPN} games`] : []),
        ...(healthyMappings === games.length ? ['All mappings are healthy! 🎉'] : [])
      ]
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
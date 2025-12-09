import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek, getNFLWeekBoundaries } from '@/lib/utils';
import { espnApi } from '@/lib/espn-api';

interface TeamStats {
  teamName: string;
  games: Array<{
    week: number;
    opponent: string;
    pointsScored: number;
    pointsAllowed: number;
    isHome: boolean;
  }>;
  avgPointsScored: number;
  avgPointsAllowed: number;
  medianPointsScored: number;
  medianPointsAllowed: number;
}

interface GameAnalysis {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  bovadaOverUnder?: number;
  awayTeamStats: TeamStats;
  homeTeamStats: TeamStats;
  projectedTotal: number;
  difference: number; // projectedTotal - bovadaOverUnder
  recommendation: 'over' | 'under' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get last N games for a team from ESPN scoreboards
 */
async function getTeamRecentGames(teamName: string, currentWeek: number, numGames: number = 4): Promise<TeamStats> {
  const games: TeamStats['games'] = [];
  const teamStats: TeamStats = {
    teamName,
    games: [],
    avgPointsScored: 0,
    avgPointsAllowed: 0,
    medianPointsScored: 0,
    medianPointsAllowed: 0,
  };

  // Fetch games from previous weeks (going backwards from current week)
  for (let week = currentWeek - 1; week >= Math.max(1, currentWeek - 10) && games.length < numGames; week--) {
    try {
      const scoreboard = await espnApi.getScoreboard(week);
      if (!scoreboard || !scoreboard.events) continue;

      for (const event of scoreboard.events) {
        const competition = event.competitions[0];
        if (!competition) continue;

        const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');

        if (!homeCompetitor || !awayCompetitor) continue;

        const homeTeam = homeCompetitor.team.displayName;
        const awayTeam = awayCompetitor.team.displayName;
        const homeScore = parseInt(homeCompetitor.score || '0');
        const awayScore = parseInt(awayCompetitor.score || '0');

        // Only include completed games
        if (!competition.status.type.completed) continue;

        // Check if this team played in this game
        if (homeTeam === teamName) {
          games.push({
            week,
            opponent: awayTeam,
            pointsScored: homeScore,
            pointsAllowed: awayScore,
            isHome: true,
          });
        } else if (awayTeam === teamName) {
          games.push({
            week,
            opponent: homeTeam,
            pointsScored: awayScore,
            pointsAllowed: homeScore,
            isHome: false,
          });
        }

        if (games.length >= numGames) break;
      }
    } catch (error) {
      console.error(`Error fetching Week ${week} for ${teamName}:`, error);
    }
  }

  // Calculate averages and median
  if (games.length > 0) {
    const totalScored = games.reduce((sum, game) => sum + game.pointsScored, 0);
    const totalAllowed = games.reduce((sum, game) => sum + game.pointsAllowed, 0);
    teamStats.games = games;
    teamStats.avgPointsScored = totalScored / games.length;
    teamStats.avgPointsAllowed = totalAllowed / games.length;
    
    // Calculate median
    const scoredValues = games.map(g => g.pointsScored).sort((a, b) => a - b);
    const allowedValues = games.map(g => g.pointsAllowed).sort((a, b) => a - b);
    const mid = Math.floor(scoredValues.length / 2);
    teamStats.medianPointsScored = scoredValues.length % 2 === 0
      ? (scoredValues[mid - 1] + scoredValues[mid]) / 2
      : scoredValues[mid];
    teamStats.medianPointsAllowed = allowedValues.length % 2 === 0
      ? (allowedValues[mid - 1] + allowedValues[mid]) / 2
      : allowedValues[mid];
  }

  return teamStats;
}

/**
 * Smart logic to project total points using MEDIAN (more robust to outliers)
 * Uses: (Away Offense Median + Home Defense Median) / 2 + (Home Offense Median + Away Defense Median) / 2
 */
function projectTotalPoints(awayStats: TeamStats, homeStats: TeamStats, useMedian: boolean = true): number {
  const awayOffense = useMedian ? awayStats.medianPointsScored : awayStats.avgPointsScored;
  const awayDefense = useMedian ? awayStats.medianPointsAllowed : awayStats.avgPointsAllowed;
  const homeOffense = useMedian ? homeStats.medianPointsScored : homeStats.avgPointsScored;
  const homeDefense = useMedian ? homeStats.medianPointsAllowed : homeStats.avgPointsAllowed;
  
  // Average of both teams' expected points
  const awayExpectedPoints = (awayOffense + homeDefense) / 2;
  const homeExpectedPoints = (homeOffense + awayDefense) / 2;
  const projectedTotal = awayExpectedPoints + homeExpectedPoints;

  // Note: we intentionally do NOT add a home-field bump to totals
  // because historical scoring already bakes in home/away splits.
  return Math.round(projectedTotal * 10) / 10; // Round to 1 decimal
}

/**
 * Get recommendation based on difference
 */
function getRecommendation(projectedTotal: number, bovadaLine: number): { recommendation: 'over' | 'under' | 'neutral'; confidence: 'high' | 'medium' | 'low' } {
  const difference = projectedTotal - bovadaLine;
  const absDifference = Math.abs(difference);

  let recommendation: 'over' | 'under' | 'neutral' = 'neutral';
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (absDifference < 1) {
    return { recommendation: 'neutral', confidence: 'low' };
  }

  if (difference > 0) {
    recommendation = 'over';
  } else {
    recommendation = 'under';
  }

  if (absDifference >= 4) {
    confidence = 'high';
  } else if (absDifference >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { recommendation, confidence };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    const currentWeek = weekParam ? parseInt(weekParam) : getCurrentNFLWeek();
    
    console.log(`📊 Analyzing O/U for Week ${currentWeek}...`);

    // Get current week's games with betting lines
    const { oddsApi } = await import('@/lib/odds-api');
    let games = await oddsApi.getNFLGames(currentWeek, false);

    if (games.length === 0) {
      return NextResponse.json({ error: 'No games found for this week' }, { status: 404 });
    }

    console.log(`🏈 Found ${games.length} games for Week ${currentWeek}`);

    // For completed/live games without odds, try to get them from frozen/cached data
    const { preGameOddsService, gameCacheService } = await import('@/lib/firebase-service');
    const weekendId = `2025-week-${currentWeek}`;
    
    // Enhance games with cached/frozen odds if they don't have them
    const gamesNeedingOdds = games.filter(g => !g.overUnder);
    if (gamesNeedingOdds.length > 0) {
      console.log(`🔍 ${gamesNeedingOdds.length} games missing betting lines, checking cache/frozen data...`);
      
      for (const game of gamesNeedingOdds) {
        try {
          // Try frozen odds first
          const frozenOdds = await preGameOddsService.getFrozenOdds(game.id);
          if (frozenOdds?.overUnder) {
            game.overUnder = frozenOdds.overUnder;
            game.overUnderOdds = frozenOdds.overUnderOdds;
            console.log(`💾 Restored frozen O/U for ${game.awayTeam} @ ${game.homeTeam}: ${frozenOdds.overUnder}`);
            continue;
          }
          
          // Try cached games
          const cachedData = await gameCacheService.getCachedGames(weekendId);
          if (cachedData?.games) {
            const cachedGame = cachedData.games.find(g => g.id === game.id);
            if (cachedGame?.overUnder) {
              game.overUnder = cachedGame.overUnder;
              game.overUnderOdds = cachedGame.overUnderOdds;
              console.log(`💾 Restored cached O/U for ${game.awayTeam} @ ${game.homeTeam}: ${cachedGame.overUnder}`);
              continue;
            }
          }
          
          // Last resort: Try to fetch from Odds API directly (even for completed games)
          const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
          if (apiKey) {
            try {
              const { getNFLWeekBoundaries } = await import('@/lib/utils');
              const { start, end } = getNFLWeekBoundaries(currentWeek, 2025);
              
              const oddsResponse = await fetch(
                `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?${new URLSearchParams({
                  apiKey: apiKey,
                  regions: 'us',
                  markets: 'totals',
                  oddsFormat: 'american',
                  bookmakers: 'bovada',
                })}`
              );
              
              if (oddsResponse.ok) {
                const allOdds = await oddsResponse.json();
                const weekOdds = allOdds.filter((oddsGame: any) => {
                  const gameTime = new Date(oddsGame.commence_time);
                  return gameTime >= start && gameTime < end;
                });
                
                // Try to match this game
                const matchingOdds = weekOdds.find((oddsGame: any) => {
                  const oddsHome = oddsGame.home_team.toLowerCase();
                  const oddsAway = oddsGame.away_team.toLowerCase();
                  return (
                    (oddsHome.includes(game.homeTeam.toLowerCase()) || game.homeTeam.toLowerCase().includes(oddsHome)) &&
                    (oddsAway.includes(game.awayTeam.toLowerCase()) || game.awayTeam.toLowerCase().includes(oddsAway))
                  );
                });
                
                if (matchingOdds) {
                  const bovada = matchingOdds.bookmakers?.find((b: any) => b.key === 'bovada');
                  if (bovada) {
                    const totals = bovada.markets?.find((m: any) => m.key === 'totals');
                    if (totals && totals.outcomes && totals.outcomes.length > 0) {
                      game.overUnder = totals.outcomes[0].point;
                      game.overUnderOdds = totals.outcomes[0].price;
                      console.log(`📡 Fetched fresh O/U from Odds API for ${game.awayTeam} @ ${game.homeTeam}: ${game.overUnder}`);
                      
                      // CRITICAL: Cache these odds for future use (even if game is completed)
                      try {
                        await preGameOddsService.freezeOdds(game.id, {
                          overUnder: game.overUnder,
                          overUnderOdds: game.overUnderOdds,
                          spread: game.spread,
                          spreadOdds: game.spreadOdds,
                          homeMoneyline: game.homeMoneyline,
                          awayMoneyline: game.awayMoneyline,
                        });
                        console.log(`💾 Cached betting lines for ${game.awayTeam} @ ${game.homeTeam} for future research`);
                      } catch (cacheError) {
                        console.warn(`⚠️ Could not cache odds for ${game.awayTeam} @ ${game.homeTeam}:`, cacheError);
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`⚠️ Could not fetch from Odds API for ${game.awayTeam} @ ${game.homeTeam}:`, error);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Could not restore odds for ${game.awayTeam} @ ${game.homeTeam}:`, error);
        }
      }
    }

    const analyses: GameAnalysis[] = [];

    // Analyze each game
    for (const game of games) {
      console.log(`\n📈 Analyzing: ${game.awayTeam} @ ${game.homeTeam}`);

      // Get team stats from last 4 games
      const [awayStats, homeStats] = await Promise.all([
        getTeamRecentGames(game.awayTeam, currentWeek, 4),
        getTeamRecentGames(game.homeTeam, currentWeek, 4),
      ]);

      // Project total points using median (more robust)
      const projectedTotal = projectTotalPoints(awayStats, homeStats, true);

      // Get Bovada O/U line
      const bovadaOverUnder = game.overUnder;

      // Calculate difference and recommendation
      const difference = bovadaOverUnder ? projectedTotal - bovadaOverUnder : 0;
      const { recommendation, confidence } = bovadaOverUnder 
        ? getRecommendation(projectedTotal, bovadaOverUnder)
        : { recommendation: 'neutral' as const, confidence: 'low' as const };

      analyses.push({
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        gameTime: game.gameTime.toISOString(),
        bovadaOverUnder,
        awayTeamStats: awayStats,
        homeTeamStats: homeStats,
        projectedTotal,
        difference,
        recommendation,
        confidence,
      });

      console.log(`   📊 Projected Total: ${projectedTotal}`);
      console.log(`   🎰 Bovada O/U: ${bovadaOverUnder || 'N/A'}`);
      if (bovadaOverUnder) {
        console.log(`   💡 Recommendation: ${recommendation.toUpperCase()} (${confidence} confidence, ${difference > 0 ? '+' : ''}${difference.toFixed(1)} difference)`);
      }
    }

    // Sort by absolute difference (best bets first)
    analyses.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    return NextResponse.json({
      week: currentWeek,
      analyzedAt: new Date().toISOString(),
      games: analyses,
      summary: {
        totalGames: analyses.length,
        gamesWithLines: analyses.filter(a => a.bovadaOverUnder).length,
        highConfidenceBets: analyses.filter(a => a.confidence === 'high' && a.bovadaOverUnder).length,
        mediumConfidenceBets: analyses.filter(a => a.confidence === 'medium' && a.bovadaOverUnder).length,
      },
    });
  } catch (error) {
    console.error('❌ Error analyzing O/U:', error);
    return NextResponse.json(
      { error: 'Failed to analyze O/U', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

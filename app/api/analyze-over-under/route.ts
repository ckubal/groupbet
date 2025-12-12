import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek, getNFLWeekBoundaries } from '@/lib/utils';
import { espnApi } from '@/lib/espn-api';
import {
  calculateWeatherAdjustment,
  getRestDaysInfo,
  calculateRestDaysAdjustment,
  calculateTravelAdjustment,
  calculateAltitudeAdjustment,
  isDivisionalGame,
  getGameTypeAdjustment,
} from '@/lib/nfl-adjustments';

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

interface WeatherInfo {
  temperature?: number;
  condition?: string;
  windSpeed?: number;
  windDirection?: string;
  precipitation?: string;
  humidity?: number;
  isIndoor?: boolean;
  venue?: string;
  notes?: string;
}

interface GameAnalysis {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  bovadaOverUnder?: number;
  spread?: number;
  spreadOdds?: number;
  awayMoneyline?: number;
  homeMoneyline?: number;
  awayTeamStats: TeamStats;
  homeTeamStats: TeamStats;
  projectedTotal: number;
  projectedAwayScore?: number;
  projectedHomeScore?: number;
  difference: number; // projectedTotal - bovadaOverUnder
  recommendation: 'over' | 'under' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  adjustments?: string[];
  gameContext?: string[];
  weather?: WeatherInfo;
}

/**
 * Check if this is a rematch (second time these teams play each other this season)
 */
async function isRematch(awayTeam: string, homeTeam: string, currentWeek: number): Promise<boolean> {
  if (currentWeek <= 1) return false; // Can't be a rematch in week 1
  
  try {
    // Check all previous weeks to see if these teams already played
    for (let week = 1; week < currentWeek; week++) {
      const scoreboard = await espnApi.getScoreboard(week);
      if (!scoreboard || !scoreboard.events) continue;
      
      for (const event of scoreboard.events) {
        const competition = event.competitions[0];
        if (!competition) continue;
        
        const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');
        
        if (!homeCompetitor || !awayCompetitor) continue;
        
        const prevHomeTeam = homeCompetitor.team.displayName;
        const prevAwayTeam = awayCompetitor.team.displayName;
        
        // Check if teams match (either direction)
        if ((prevHomeTeam === homeTeam && prevAwayTeam === awayTeam) ||
            (prevHomeTeam === awayTeam && prevAwayTeam === homeTeam)) {
          return true; // Found previous matchup
        }
      }
    }
    return false; // No previous matchup found
  } catch (error) {
    console.warn(`⚠️ Could not check rematch for ${awayTeam} @ ${homeTeam}:`, error);
    return false;
  }
}

/**
 * Check if a team is coming off a bye week
 */
async function isComingOffBye(teamName: string, currentWeek: number): Promise<boolean> {
  if (currentWeek <= 1) return false; // Can't have a bye in week 1
  
  try {
    const prevWeek = currentWeek - 1;
    const scoreboard = await espnApi.getScoreboard(prevWeek);
    if (!scoreboard || !scoreboard.events) return false;
    
    // Check if team played in previous week
    for (const event of scoreboard.events) {
      const competition = event.competitions[0];
      if (!competition) continue;
      
      const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeCompetitor || !awayCompetitor) continue;
      
      const homeTeam = homeCompetitor.team.displayName;
      const awayTeam = awayCompetitor.team.displayName;
      
      if (homeTeam === teamName || awayTeam === teamName) {
        return false; // Team played last week, not coming off bye
      }
    }
    
    return true; // Team didn't play last week, coming off bye
  } catch (error) {
    console.warn(`⚠️ Could not check bye week for ${teamName}:`, error);
    return false;
  }
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
async function projectTotalPoints(
  awayStats: TeamStats,
  homeStats: TeamStats,
  awayTeam: string,
  homeTeam: string,
  currentWeek: number,
  gameTime: Date,
  weather?: WeatherInfo,
  venue?: any,
  useMedian: boolean = true
): Promise<{ total: number; awayScore: number; homeScore: number; adjustments: string[]; gameContext: string[] }> {
  const awayOffense = useMedian ? awayStats.medianPointsScored : awayStats.avgPointsScored;
  const awayDefense = useMedian ? awayStats.medianPointsAllowed : awayStats.avgPointsAllowed;
  const homeOffense = useMedian ? homeStats.medianPointsScored : homeStats.avgPointsScored;
  const homeDefense = useMedian ? homeStats.medianPointsAllowed : homeStats.avgPointsAllowed;
  
  // Average of both teams' expected points (base projection)
  const awayExpectedPoints = (awayOffense + homeDefense) / 2;
  const homeExpectedPoints = (homeOffense + awayDefense) / 2;
  const baseTotal = awayExpectedPoints + homeExpectedPoints;
  
  // Calculate percentage each team contributes to base total
  const awayPercentage = baseTotal > 0 ? awayExpectedPoints / baseTotal : 0.5;
  const homePercentage = baseTotal > 0 ? homeExpectedPoints / baseTotal : 0.5;
  
  let projectedTotal = baseTotal;
  
  const adjustments: string[] = [];
  
  // Note: Home field advantage is already reflected in the team's average points scored/allowed
  // from their last 4 games, so no separate adjustment needed.
  
  // Bye week adjustments (based on historical data analysis)
  // One team off bye: -1.5 points (22 games analyzed, -3.28 point difference)
  // Both teams off bye: No adjustment (only 3 games, sample size too small)
  const [awayBye, homeBye] = await Promise.all([
    isComingOffBye(awayTeam, currentWeek),
    isComingOffBye(homeTeam, currentWeek),
  ]);
  
  if ((awayBye && !homeBye) || (!awayBye && homeBye)) {
    // Only one team off bye - slight negative adjustment
    projectedTotal -= 1.5;
    const byeTeam = awayBye ? awayTeam : homeTeam;
    adjustments.push(`${byeTeam} off bye: -1.5`);
  }
  // Note: Both teams off bye shows +6 points in data, but only 3 games (too small sample)
  
  // Game type adjustment (Thursday/Monday night)
  const gameType = getGameTypeAdjustment(gameTime);
  if (gameType.adjustment !== 0) {
    projectedTotal += gameType.adjustment;
    adjustments.push(`${gameType.reason}: ${gameType.adjustment > 0 ? '+' : ''}${gameType.adjustment.toFixed(1)}`);
  }
  
  // Weather adjustments
  if (weather) {
    const weatherAdj = calculateWeatherAdjustment(weather);
    if (weatherAdj.adjustment !== 0) {
      projectedTotal += weatherAdj.adjustment;
      adjustments.push(`Weather (${weatherAdj.reason}): ${weatherAdj.adjustment > 0 ? '+' : ''}${weatherAdj.adjustment.toFixed(1)}`);
    }
  }
  
  // Rest days adjustments
  try {
    const restDaysInfo = await getRestDaysInfo(awayTeam, homeTeam, gameTime, currentWeek, espnApi);
    const restAdj = calculateRestDaysAdjustment(restDaysInfo);
    if (restAdj.adjustment !== 0) {
      projectedTotal += restAdj.adjustment;
      restAdj.reasons.forEach(reason => adjustments.push(`Rest (${reason})`));
    }
  } catch (error) {
    console.warn(`⚠️ Could not calculate rest days:`, error);
  }
  
  // Travel and time zone adjustments
  if (venue) {
    const travelAdj = calculateTravelAdjustment(awayTeam, homeTeam, gameTime, venue);
    if (travelAdj.adjustment !== 0) {
      projectedTotal += travelAdj.adjustment;
      adjustments.push(`Travel (${travelAdj.reason}): ${travelAdj.adjustment > 0 ? '+' : ''}${travelAdj.adjustment.toFixed(1)}`);
    }
    
    // Altitude adjustment (Denver)
    const altitudeAdj = calculateAltitudeAdjustment(venue);
    if (altitudeAdj.adjustment !== 0) {
      projectedTotal += altitudeAdj.adjustment;
      adjustments.push(`Altitude (${altitudeAdj.reason}): +${altitudeAdj.adjustment.toFixed(1)}`);
    }
  }
  
  // Note: Efficiency matchups are already captured in the base projection
  // (avgPointsScored/allowed already reflect offensive/defensive strength)
  // Adding efficiency adjustments would double-count these factors.
  
  // Game context factors (informational, no adjustment)
  const gameContext: string[] = [];
  
  // Check if divisional game
  const isDivisional = isDivisionalGame(awayTeam, homeTeam);
  if (isDivisional) {
    gameContext.push('Divisional game');
  }
  
  // Check if rematch (second time playing)
  const isRematchGame = await isRematch(awayTeam, homeTeam, currentWeek);
  if (isRematchGame) {
    gameContext.push('Rematch (2nd meeting)');
  }
  
  // Check game type (Thursday/Monday night) - use Eastern timezone to match adjustment logic
  const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = easternDate.getDay(); // 0=Sunday, 1=Monday, 4=Thursday
  if (dayOfWeek === 4) { // Thursday
    gameContext.push('Thursday Night Football');
  } else if (dayOfWeek === 1) { // Monday
    gameContext.push('Monday Night Football');
  } else if (dayOfWeek === 0) { // Sunday - check if it's Sunday Night Football
    // Sunday Night Football is typically 8:20pm ET (20:20)
    const easternHour = easternDate.getHours();
    if (easternHour >= 20) { // 8pm ET or later
      gameContext.push('Sunday Night Football');
    }
  }
  
  // Apply adjustments proportionally to each team based on their percentage of base total
  // This ensures the predicted scores add up to the adjusted total
  const adjustedAwayScore = awayPercentage * projectedTotal;
  const adjustedHomeScore = homePercentage * projectedTotal;
  
  return {
    total: Math.round(projectedTotal * 10) / 10,
    awayScore: Math.round(adjustedAwayScore * 10) / 10,
    homeScore: Math.round(adjustedHomeScore * 10) / 10,
    adjustments,
    gameContext
  };
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

      // Try to get weather info from ESPN (optional)
      let weather: WeatherInfo | undefined;
      let venue: any;
      try {
        // Try to fetch ESPN event data for weather/venue
        const espnData = await espnApi.getScoreboard(currentWeek);
        if (espnData?.events) {
          const espnEvent = espnData.events.find((e: any) => {
            const comp = e.competitions?.[0];
            if (!comp) return false;
            const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away');
            return (
              homeComp?.team?.displayName === game.homeTeam &&
              awayComp?.team?.displayName === game.awayTeam
            );
          });
          
          if (espnEvent?.competitions?.[0]) {
            const competition = espnEvent.competitions[0];
            venue = competition.venue;
            
            // Get weather info if available
            const competitionAny = competition as any;
            if (competitionAny.weather || competition.venue) {
              weather = {
                isIndoor: competition.venue?.indoor || false,
                venue: competition.venue?.fullName || 'Unknown',
                temperature: competitionAny.weather?.temperature,
                condition: competitionAny.weather?.displayValue || competitionAny.weather?.shortDisplayValue,
                windSpeed: competitionAny.weather?.windSpeed,
                windDirection: competitionAny.weather?.windDirection,
                humidity: competitionAny.weather?.humidity,
              };
              
              // Determine precipitation
              if (weather.condition) {
                const conditionLower = weather.condition.toLowerCase();
                if (conditionLower.includes('snow') || conditionLower.includes('snowy')) {
                  weather.precipitation = 'Snow';
                } else if (conditionLower.includes('rain') || conditionLower.includes('rainy') || conditionLower.includes('shower')) {
                  weather.precipitation = 'Rain';
                } else {
                  weather.precipitation = 'None';
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch weather/venue data:`, error);
      }

      // Get team stats from last 4 games
      const [awayStats, homeStats] = await Promise.all([
        getTeamRecentGames(game.awayTeam, currentWeek, 4),
        getTeamRecentGames(game.homeTeam, currentWeek, 4),
      ]);

      // Project total points using median with all adjustments
      const projection = await projectTotalPoints(
        awayStats,
        homeStats,
        game.awayTeam,
        game.homeTeam,
        currentWeek,
        game.gameTime,
        weather,
        venue,
        true
      );
      const projectedTotal = projection.total;

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
        spread: game.spread,
        spreadOdds: game.spreadOdds,
        awayMoneyline: game.awayMoneyline,
        homeMoneyline: game.homeMoneyline,
        awayTeamStats: awayStats,
        homeTeamStats: homeStats,
        projectedTotal,
        projectedAwayScore: projection.awayScore,
        projectedHomeScore: projection.homeScore,
        difference,
        recommendation,
        confidence,
        adjustments: projection.adjustments,
        gameContext: projection.gameContext,
        weather,
      });

      // Save prediction to Firebase for tracking accuracy
      if (recommendation !== 'neutral' && bovadaOverUnder) {
        try {
          const { predictionService } = await import('@/lib/firebase-service');
          await predictionService.savePrediction({
            gameId: game.id,
            weekendId: game.weekendId,
            week: currentWeek,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            gameTime: game.gameTime,
            projectedTotal,
            bovadaOverUnder,
            recommendation,
            confidence,
            adjustments: projection.adjustments,
            gameContext: projection.gameContext,
            predictedAt: new Date(),
          });
        } catch (error) {
          console.warn(`⚠️ Could not save prediction for ${game.awayTeam} @ ${game.homeTeam}:`, error);
        }
      }

      console.log(`   📊 Projected Total: ${projectedTotal}`);
      if (projection.adjustments.length > 0) {
        console.log(`   📈 Adjustments: ${projection.adjustments.join(', ')}`);
      }
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

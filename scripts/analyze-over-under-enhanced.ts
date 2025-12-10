/**
 * Enhanced Over/Under Analysis Script with Weather and Injury Information
 * Run with: npx tsx scripts/analyze-over-under-enhanced.ts [week]
 * 
 * For Week 15 (Dec 11-15, 2025): npx tsx scripts/analyze-over-under-enhanced.ts 15
 */

import { getCurrentNFLWeek } from '../lib/utils';
import { espnApi } from '../lib/espn-api';
import {
  calculateWeatherAdjustment,
  getRestDaysInfo,
  calculateRestDaysAdjustment,
  calculateTravelAdjustment,
  calculateAltitudeAdjustment,
  isDivisionalGame,
} from '../lib/nfl-adjustments';

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
  isIndoor: boolean;
  venue?: string;
  notes?: string;
}

interface InjuryInfo {
  awayTeamInjuries?: string[];
  homeTeamInjuries?: string[];
  keyPlayers?: string[];
  notes?: string;
}

interface GameAnalysis {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  bovadaOverUnder?: number;
  awayTeamStats: TeamStats;
  homeTeamStats: TeamStats;
  projectedTotal: number;
  difference: number;
  recommendation: 'over' | 'under' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  weather?: WeatherInfo;
  injuries?: InjuryInfo;
  adjustments?: string[];
  gameContext?: string[];
}

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

  console.log(`  📊 Fetching last ${numGames} games for ${teamName}...`);

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

        if (!competition.status.type.completed) continue;

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
      console.error(`    ⚠️ Error fetching Week ${week}:`, error);
    }
  }

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
    
    console.log(`    ✅ Found ${games.length} games`);
    console.log(`    📈 Mean Points Scored: ${teamStats.avgPointsScored.toFixed(1)} | Median: ${teamStats.medianPointsScored.toFixed(1)}`);
    console.log(`    📉 Mean Points Allowed: ${teamStats.avgPointsAllowed.toFixed(1)} | Median: ${teamStats.medianPointsAllowed.toFixed(1)}`);
  } else {
    console.log(`    ⚠️ No games found for ${teamName}`);
  }

  return teamStats;
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
 * Returns true if team didn't play in the previous week
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
    console.warn(`    ⚠️ Could not check bye week for ${teamName}:`, error);
    return false;
  }
}

/**
 * Get game type adjustment based on day/time
 * Based on historical NFL data:
 * - Thursday Night: -2.5 points (short rest, lower scoring)
 * - Monday Night: -1.0 points (slightly lower scoring)
 * - Sunday games: no adjustment
 */
function getGameTypeAdjustment(gameTime: Date): { adjustment: number; reason: string } {
  const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = easternDate.getDay(); // 0=Sunday, 1=Monday, 4=Thursday
  
  if (dayOfWeek === 4) { // Thursday
    return { adjustment: -2.5, reason: 'Thursday Night (short rest, historically lower scoring)' };
  } else if (dayOfWeek === 1) { // Monday
    return { adjustment: -1.0, reason: 'Monday Night (slightly lower scoring)' };
  }
  
  return { adjustment: 0, reason: 'Sunday game (no adjustment)' };
}

/**
 * Enhanced projection with statistical adjustments
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
  useMedian: boolean = false
): Promise<{ total: number; adjustments: string[]; gameContext: string[] }> {
  const awayOffense = useMedian ? awayStats.medianPointsScored : awayStats.avgPointsScored;
  const awayDefense = useMedian ? awayStats.medianPointsAllowed : awayStats.avgPointsAllowed;
  const homeOffense = useMedian ? homeStats.medianPointsScored : homeStats.avgPointsScored;
  const homeDefense = useMedian ? homeStats.medianPointsAllowed : homeStats.medianPointsAllowed;
  
  const awayExpectedPoints = (awayOffense + homeDefense) / 2;
  const homeExpectedPoints = (homeOffense + awayDefense) / 2;
  let projectedTotal = awayExpectedPoints + homeExpectedPoints;
  
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
    console.warn(`    ⚠️ Could not calculate rest days:`, error);
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
  
  return {
    total: Math.round(projectedTotal * 10) / 10,
    adjustments,
    gameContext
  };
}

function getRecommendation(projectedTotal: number, bovadaLine: number): { recommendation: 'over' | 'under' | 'neutral'; confidence: 'high' | 'medium' | 'low' } {
  const difference = projectedTotal - bovadaLine;
  const absDifference = Math.abs(difference);

  if (absDifference < 1) {
    return { recommendation: 'neutral', confidence: 'low' };
  }

  const recommendation = difference > 0 ? 'over' : 'under';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  if (absDifference >= 4) {
    confidence = 'high';
  } else if (absDifference >= 2) {
    confidence = 'medium';
  }

  return { recommendation, confidence };
}

async function getWeatherInfo(competition: any, gameTime: Date): Promise<WeatherInfo> {
  const weather: WeatherInfo = {
    isIndoor: competition.venue?.indoor || false,
    venue: competition.venue?.fullName || 'Unknown',
  };

  // If indoor, no weather concerns
  if (weather.isIndoor) {
    weather.notes = 'Indoor stadium - weather not a factor';
    return weather;
  }

  // Check if ESPN provides weather data (usually available closer to game time)
  const espnWeather = (competition as any).weather;
  if (espnWeather) {
    weather.temperature = espnWeather.temperature;
    weather.condition = espnWeather.displayValue || espnWeather.shortDisplayValue;
    weather.windSpeed = espnWeather.windSpeed;
    weather.windDirection = espnWeather.windDirection;
    weather.humidity = espnWeather.humidity;
    
    // Determine precipitation
    if (weather.condition) {
      const conditionLower = weather.condition.toLowerCase();
      if (conditionLower.includes('snow') || conditionLower.includes('snowy')) {
        weather.precipitation = 'Snow';
      } else if (conditionLower.includes('rain') || conditionLower.includes('rainy') || conditionLower.includes('shower')) {
        weather.precipitation = 'Rain';
      } else if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
        weather.precipitation = 'None';
      }
    }
    
    return weather;
  }

  // If no ESPN weather data, try to get forecast from OpenWeatherMap (if API key available)
  // For now, we'll note that weather data is not yet available
  weather.notes = 'Weather forecast not yet available (check closer to game time)';
  
  // Try to get forecast from OpenWeatherMap if API key is available
  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
  if (openWeatherApiKey && competition.venue?.address) {
    try {
      const city = competition.venue.address.city;
      const state = competition.venue.address.state;
      
      // Get coordinates for the city (simplified - in production, use geocoding)
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city},${state},US&appid=${openWeatherApiKey}&units=imperial`;
      
      const response = await fetch(forecastUrl);
      if (response.ok) {
        const data = await response.json();
        
        // Find forecast closest to game time
        const gameTimestamp = gameTime.getTime() / 1000;
        const closestForecast = data.list?.reduce((closest: any, current: any) => {
          const closestDiff = Math.abs(closest.dt - gameTimestamp);
          const currentDiff = Math.abs(current.dt - gameTimestamp);
          return currentDiff < closestDiff ? current : closest;
        });
        
        if (closestForecast) {
          weather.temperature = Math.round(closestForecast.main.temp);
          weather.condition = closestForecast.weather[0]?.main || 'Unknown';
          weather.windSpeed = Math.round(closestForecast.wind?.speed || 0);
          weather.humidity = closestForecast.main.humidity;
          
          // Determine precipitation
          const conditionLower = weather.condition.toLowerCase();
          if (conditionLower.includes('snow')) {
            weather.precipitation = 'Snow';
          } else if (conditionLower.includes('rain')) {
            weather.precipitation = 'Rain';
          } else {
            weather.precipitation = 'None';
          }
          
          weather.notes = `Forecast from OpenWeatherMap for ${city}, ${state}`;
        }
      }
    } catch (error) {
      console.warn(`    ⚠️ Could not fetch weather forecast:`, error);
    }
  }

  return weather;
}

async function getInjuryInfo(awayTeam: string, homeTeam: string, espnEventId?: string): Promise<InjuryInfo> {
  const injuries: InjuryInfo = {
    awayTeamInjuries: [],
    homeTeamInjuries: [],
    keyPlayers: [],
  };

  // Try to get injury data from ESPN if event ID is available
  if (espnEventId) {
    try {
      // ESPN injury data is typically in a separate endpoint
      // For now, we'll note that injury data needs to be checked manually
      injuries.notes = 'Injury data not automatically available. Check ESPN or team injury reports manually.';
    } catch (error) {
      console.warn(`    ⚠️ Could not fetch injury data:`, error);
    }
  }

  // Note: In a production system, you might integrate with:
  // - ESPN injury reports API
  // - NFL.com injury reports
  // - SportsDataIO or similar services
  
  if (injuries.notes) {
    injuries.notes += ' Key players to monitor: Starting QBs, RBs, WR1s, and defensive stars.';
  }

  return injuries;
}

async function fetchGamesDirectly(week: number) {
  // Fetch games directly from ESPN
  const espnData = await espnApi.getScoreboard(week);
  if (!espnData || !espnData.events) {
    return [];
  }

  // Fetch betting lines from Odds API
  const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY || '0493842a2e9dce0503d7b92af55d64dc';
  let oddsData: any[] = [];
  
  if (apiKey) {
    try {
      const { getNFLWeekBoundaries } = await import('../lib/utils');
      const { start, end } = getNFLWeekBoundaries(week, 2025);
      
      const oddsResponse = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?${new URLSearchParams({
          apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h',
          oddsFormat: 'american',
          bookmakers: 'bovada',
        })}`
      );
      
      if (oddsResponse.ok) {
        const allOdds = await oddsResponse.json();
        oddsData = allOdds.filter((game: any) => {
          const gameTime = new Date(game.commence_time);
          return gameTime >= start && gameTime < end;
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch Odds API data:', error);
    }
  }

  // Convert ESPN events to games with betting lines
  const games: Array<{
    awayTeam: string;
    homeTeam: string;
    gameTime: Date;
    overUnder?: number;
    espnEventId?: string;
    competition?: any;
  }> = [];

  for (const event of espnData.events) {
    const competition = event.competitions[0];
    if (!competition) continue;

    const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');

    if (!homeCompetitor || !awayCompetitor) continue;

    const homeTeam = homeCompetitor.team.displayName;
    const awayTeam = awayCompetitor.team.displayName;
    const gameTime = new Date(event.date);

    // Find matching odds
    const matchingOdds = oddsData.find((odds: any) => {
      const oddsHome = odds.home_team.toLowerCase();
      const oddsAway = odds.away_team.toLowerCase();
      return (
        (oddsHome.includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(oddsHome)) &&
        (oddsAway.includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(oddsAway))
      );
    });

    let overUnder: number | undefined;
    if (matchingOdds) {
      const bovada = matchingOdds.bookmakers?.find((b: any) => b.key === 'bovada');
      if (bovada) {
        const totals = bovada.markets?.find((m: any) => m.key === 'totals');
        if (totals && totals.outcomes && totals.outcomes.length > 0) {
          overUnder = totals.outcomes[0].point;
        }
      }
    }

    games.push({
      awayTeam,
      homeTeam,
      gameTime,
      overUnder,
      espnEventId: event.id,
      competition,
    });
  }

  return games;
}

async function main() {
  const weekArg = process.argv[2];
  const currentWeek = weekArg ? parseInt(weekArg) : getCurrentNFLWeek();
  
  console.log(`\n🏈 ENHANCED OVER/UNDER ANALYSIS FOR WEEK ${currentWeek}\n`);
  console.log(`📅 Today: ${new Date().toLocaleDateString()}\n`);

  // Get current week's games with betting lines
  const games = await fetchGamesDirectly(currentWeek);

  if (games.length === 0) {
    console.error('❌ No games found for this week');
    process.exit(1);
  }

  console.log(`📊 Found ${games.length} games for Week ${currentWeek}\n`);
  console.log('='.repeat(80));

  const analyses: GameAnalysis[] = [];

  for (const game of games) {
    console.log(`\n📈 ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`   🕐 ${game.gameTime.toLocaleString()}`);
    console.log(`   🎰 Bovada O/U: ${game.overUnder || 'N/A'}\n`);

    // Get weather and venue information first (needed for adjustments)
    console.log(`   🌤️ Fetching weather information...`);
    const weather = await getWeatherInfo(game.competition, game.gameTime);
    const venue = game.competition?.venue;

    const [awayStats, homeStats] = await Promise.all([
      getTeamRecentGames(game.awayTeam, currentWeek, 4),
      getTeamRecentGames(game.homeTeam, currentWeek, 4),
    ]);

    // Get enhanced projections with adjustments (including weather, rest days, travel)
    const [projectionMean, projectionMedian] = await Promise.all([
      projectTotalPoints(awayStats, homeStats, game.awayTeam, game.homeTeam, currentWeek, game.gameTime, weather, venue, false),
      projectTotalPoints(awayStats, homeStats, game.awayTeam, game.homeTeam, currentWeek, game.gameTime, weather, venue, true),
    ]);

    const projectedTotalMean = projectionMean.total;
    const projectedTotalMedian = projectionMedian.total;
    const bovadaOverUnder = game.overUnder;
    const differenceMean = bovadaOverUnder ? projectedTotalMean - bovadaOverUnder : 0;
    const differenceMedian = bovadaOverUnder ? projectedTotalMedian - bovadaOverUnder : 0;
    const { recommendation: recMean, confidence: confMean } = bovadaOverUnder
      ? getRecommendation(projectedTotalMean, bovadaOverUnder)
      : { recommendation: 'neutral' as const, confidence: 'low' as const };
    const { recommendation: recMedian, confidence: confMedian } = bovadaOverUnder
      ? getRecommendation(projectedTotalMedian, bovadaOverUnder)
      : { recommendation: 'neutral' as const, confidence: 'low' as const };
    
    // Use median for final recommendation
    const projectedTotal = projectedTotalMedian;
    const difference = differenceMedian;
    const recommendation = recMedian;
    const confidence = confMedian;
    const adjustments = projectionMedian.adjustments;
    const gameContext = projectionMedian.gameContext;
    
    // Get injury information
    console.log(`   🏥 Checking injury information...`);
    const injuries = await getInjuryInfo(game.awayTeam, game.homeTeam, game.espnEventId);

    analyses.push({
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      gameTime: game.gameTime.toISOString(),
      bovadaOverUnder,
      awayTeamStats: awayStats,
      homeTeamStats: homeStats,
      projectedTotal: projectedTotalMedian,
      difference: differenceMedian,
      recommendation,
      confidence,
      weather,
      injuries,
      adjustments,
      gameContext,
    });

    console.log(`\n   💡 PROJECTION:`);
    console.log(`      Mean Projection: ${projectedTotalMean.toFixed(1)} | Median Projection: ${projectedTotalMedian.toFixed(1)}`);
    
    // Show game context (divisional, rematch, etc.)
    if (gameContext.length > 0) {
      console.log(`      📋 Game Context: ${gameContext.join(', ')}`);
    }
    
    // Show adjustments
    if (adjustments.length > 0) {
      console.log(`      📊 Adjustments Applied:`);
      adjustments.forEach(adj => {
        console.log(`         • ${adj}`);
      });
    } else {
      console.log(`      📊 Adjustments Applied: None`);
    }
    
    if (bovadaOverUnder) {
      console.log(`      Bovada Line: ${bovadaOverUnder}`);
      console.log(`      Mean Difference: ${differenceMean > 0 ? '+' : ''}${differenceMean.toFixed(1)} | Median Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(1)}`);
      console.log(`      Mean Recommendation: ${recMean.toUpperCase()} (${confMean}) | Median Recommendation: ${recommendation.toUpperCase()} (${confidence})`);
      
      const emoji = recommendation === 'over' ? '⬆️' : '⬇️';
      const color = confidence === 'high' ? '🟢' : confidence === 'medium' ? '🟡' : '🔴';
      console.log(`      ${emoji} ${color} BET (MEDIAN): ${recommendation.toUpperCase()} ${bovadaOverUnder}`);
      
      // Show if recommendation changed
      if (recMean !== recMedian) {
        const meanEmoji = recMean === 'over' ? '⬆️' : '⬇️';
        const meanColor = confMean === 'high' ? '🟢' : confMean === 'medium' ? '🟡' : '🔴';
        console.log(`      ⚠️ CHANGED FROM MEAN: ${meanEmoji} ${meanColor} ${recMean.toUpperCase()} (${confMean})`);
      }
    } else {
      console.log(`      ⚠️ No Bovada line available`);
    }

    // Display weather information
    console.log(`\n   🌤️ WEATHER:`);
    if (weather.isIndoor) {
      console.log(`      🏟️ ${weather.venue} - INDOOR (Weather not a factor)`);
    } else {
      console.log(`      🏟️ ${weather.venue || 'Unknown Venue'}`);
      if (weather.temperature !== undefined) {
        console.log(`      🌡️ Temperature: ${weather.temperature}°F`);
      }
      if (weather.condition) {
        console.log(`      ☁️ Condition: ${weather.condition}`);
      }
      if (weather.precipitation) {
        const precipEmoji = weather.precipitation === 'Snow' ? '❄️' : weather.precipitation === 'Rain' ? '🌧️' : '☀️';
        console.log(`      ${precipEmoji} Precipitation: ${weather.precipitation}`);
      }
      if (weather.windSpeed !== undefined) {
        console.log(`      💨 Wind: ${weather.windSpeed} mph${weather.windDirection ? ` ${weather.windDirection}` : ''}`);
      }
      if (weather.humidity !== undefined) {
        console.log(`      💧 Humidity: ${weather.humidity}%`);
      }
      if (weather.notes) {
        console.log(`      ℹ️ ${weather.notes}`);
      }
    }

    // Display injury information
    console.log(`\n   🏥 INJURIES:`);
    if (injuries.notes) {
      console.log(`      ℹ️ ${injuries.notes}`);
    }
    if (injuries.awayTeamInjuries && injuries.awayTeamInjuries.length > 0) {
      console.log(`      ${game.awayTeam}: ${injuries.awayTeamInjuries.join(', ')}`);
    }
    if (injuries.homeTeamInjuries && injuries.homeTeamInjuries.length > 0) {
      console.log(`      ${game.homeTeam}: ${injuries.homeTeamInjuries.join(', ')}`);
    }
    if (injuries.keyPlayers && injuries.keyPlayers.length > 0) {
      console.log(`      ⭐ Key Players to Monitor: ${injuries.keyPlayers.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));
  }

  // Full table with adjustments
  console.log('\n\n📊 FULL WEEK 15 OVER/UNDER TABLE\n');
  console.log('='.repeat(140));
  console.log(
    'Game'.padEnd(45) + '|' +
    'Bovada'.padEnd(8) + '|' +
    'Projected'.padEnd(10) + '|' +
    'Diff'.padEnd(7) + '|' +
    'Bet'.padEnd(8) + '|' +
    'Adjustments & Context'
  );
  console.log('='.repeat(140));
  
  analyses.forEach(analysis => {
    const gameName = `${analysis.awayTeam} @ ${analysis.homeTeam}`;
    const bovada = analysis.bovadaOverUnder ? analysis.bovadaOverUnder.toString() : 'N/A';
    const projected = analysis.projectedTotal.toFixed(1);
    const diff = analysis.difference > 0 ? `+${analysis.difference.toFixed(1)}` : analysis.difference.toFixed(1);
    const emoji = analysis.recommendation === 'over' ? '⬆️' : analysis.recommendation === 'under' ? '⬇️' : '➡️';
    const confEmoji = analysis.confidence === 'high' ? '🟢' : analysis.confidence === 'medium' ? '🟡' : '🔴';
    const bet = `${emoji} ${confEmoji} ${analysis.recommendation.toUpperCase()}`;
    
    // Combine all adjustments and context
    const allFactors: string[] = [];
    
    // Add game context (divisional, rematch)
    if (analysis.gameContext && analysis.gameContext.length > 0) {
      allFactors.push(...analysis.gameContext);
    }
    
    // Add adjustments (bye week, game type, altitude, weather, etc.)
    if (analysis.adjustments && analysis.adjustments.length > 0) {
      allFactors.push(...analysis.adjustments);
    }
    
    const adjustmentsStr = allFactors.length > 0 ? allFactors.join('; ') : 'None';
    
    console.log(
      gameName.padEnd(45) + '|' +
      bovada.padEnd(8) + '|' +
      projected.padEnd(10) + '|' +
      diff.padEnd(7) + '|' +
      bet.padEnd(8) + '|' +
      adjustmentsStr
    );
  });
  console.log('='.repeat(140));

  // Summary
  console.log('\n\n📊 SUMMARY\n');
  console.log(`Total Games: ${analyses.length}`);
  console.log(`Games with Lines: ${analyses.filter(a => a.bovadaOverUnder).length}`);
  console.log(`High Confidence Bets: ${analyses.filter(a => a.confidence === 'high' && a.bovadaOverUnder).length}`);
  console.log(`Medium Confidence Bets: ${analyses.filter(a => a.confidence === 'medium' && a.bovadaOverUnder).length}`);
  console.log(`Low Confidence Bets: ${analyses.filter(a => a.confidence === 'low' && a.bovadaOverUnder).length}`);

  // Top recommendations
  const topBets = analyses
    .filter(a => a.bovadaOverUnder && a.confidence !== 'low')
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 5);

  if (topBets.length > 0) {
    console.log('\n🎯 TOP RECOMMENDATIONS:\n');
    topBets.forEach((bet, i) => {
      const emoji = bet.recommendation === 'over' ? '⬆️' : '⬇️';
      const confEmoji = bet.confidence === 'high' ? '🟢' : '🟡';
      console.log(`${i + 1}. ${emoji} ${confEmoji} ${bet.awayTeam} @ ${bet.homeTeam}`);
      console.log(`   ${bet.recommendation.toUpperCase()} ${bet.bovadaOverUnder} (Projected: ${bet.projectedTotal.toFixed(1)}, Diff: ${bet.difference > 0 ? '+' : ''}${bet.difference.toFixed(1)})`);
      
      // Show weather impact if significant
      if (bet.weather && !bet.weather.isIndoor) {
        if (bet.weather.precipitation === 'Snow' || bet.weather.precipitation === 'Rain') {
          console.log(`   ⚠️ Weather Alert: ${bet.weather.precipitation} expected - may favor UNDER`);
        }
        if (bet.weather.windSpeed && bet.weather.windSpeed > 15) {
          console.log(`   ⚠️ Wind Alert: ${bet.weather.windSpeed} mph winds - may favor UNDER`);
        }
      }
    });
  }

  // Weather summary
  const outdoorGames = analyses.filter(a => a.weather && !a.weather.isIndoor);
  if (outdoorGames.length > 0) {
    console.log('\n🌤️ WEATHER SUMMARY FOR OUTDOOR GAMES:\n');
    outdoorGames.forEach(game => {
      if (game.weather) {
        const weather = game.weather;
        console.log(`${game.awayTeam} @ ${game.homeTeam}:`);
        if (weather.temperature !== undefined) {
          console.log(`  🌡️ ${weather.temperature}°F`);
        }
        if (weather.precipitation) {
          const precipEmoji = weather.precipitation === 'Snow' ? '❄️' : weather.precipitation === 'Rain' ? '🌧️' : '';
          console.log(`  ${precipEmoji} ${weather.precipitation}`);
        }
        if (weather.windSpeed !== undefined && weather.windSpeed > 10) {
          console.log(`  💨 Wind: ${weather.windSpeed} mph`);
        }
        if (weather.notes && !weather.notes.includes('not yet available')) {
          console.log(`  ℹ️ ${weather.notes}`);
        }
      }
    });
  }
}

main().catch(console.error);

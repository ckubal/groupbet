import { NextRequest, NextResponse } from 'next/server';
import { getNFLWeekBoundaries } from '@/lib/utils';
import { generateGameId, generateReadableGameId, doGamesMatch, normalizeTeamName } from '@/lib/game-id-generator';
import { getTimeSlot } from '@/lib/time-slot-utils';
import { historicalOverUnderService, gameIdMappingService } from '@/lib/firebase-service';
import { espnApi } from '@/lib/espn-api';

// Helper function to extract weather data from ESPN competition
function extractWeatherData(competition: any): {
  venue: {
    name: string;
    city: string;
    state?: string;
    isIndoor: boolean;
    isDome: boolean;
  };
  weather?: {
    temperature?: number;
    condition?: string;
    windSpeed?: number;
    windDirection?: string;
    humidity?: number;
    precipitation?: 'None' | 'Rain' | 'Snow' | 'Other';
  };
} {
  const venue = competition.venue || {};
  const venueData = {
    name: venue.fullName || 'Unknown',
    city: venue.address?.city || 'Unknown',
    state: venue.address?.state,
    isIndoor: venue.indoor || false,
    isDome: venue.dome || false,
  };

  const weatherData = competition.weather;
  if (!weatherData) {
    return { venue: venueData };
  }

  let precipitation: 'None' | 'Rain' | 'Snow' | 'Other' = 'None';
  if (weatherData.displayValue || weatherData.shortDisplayValue) {
    const condition = (weatherData.displayValue || weatherData.shortDisplayValue).toLowerCase();
    if (condition.includes('snow') || condition.includes('snowy')) {
      precipitation = 'Snow';
    } else if (condition.includes('rain') || condition.includes('rainy') || condition.includes('shower')) {
      precipitation = 'Rain';
    } else if (condition.includes('clear') || condition.includes('sunny')) {
      precipitation = 'None';
    } else {
      precipitation = 'Other';
    }
  }

  return {
    venue: venueData,
    weather: {
      temperature: weatherData.temperature,
      condition: weatherData.displayValue || weatherData.shortDisplayValue,
      windSpeed: weatherData.windSpeed,
      windDirection: weatherData.windDirection,
      humidity: weatherData.humidity,
      precipitation,
    },
  };
}

// Helper function to extract game timing
function extractGameTiming(gameTime: Date, competition: any): {
  timeSlot: 'thursday' | 'sunday_early' | 'sunday_afternoon' | 'sunday_night' | 'monday' | 'saturday';
  isInternational: boolean;
} {
  const timeSlot = getTimeSlot(gameTime, false);
  
  // Check for international games
  const venue = competition.venue || {};
  const venueName = (venue.fullName || '').toLowerCase();
  const venueCity = (venue.address?.city || '').toLowerCase();
  const isInternational = 
    venueName.includes('london') ||
    venueName.includes('tottenham') ||
    venueName.includes('wembley') ||
    venueName.includes('frankfurt') ||
    venueName.includes('munich') ||
    venueName.includes('germany') ||
    venueCity.includes('london') ||
    venueCity.includes('frankfurt') ||
    venueCity.includes('munich') ||
    (competition.notes && competition.notes.some((note: any) => 
      note.type === 'event' && (note.headline?.toLowerCase().includes('london') || 
      note.headline?.toLowerCase().includes('germany'))
    ));

  return {
    timeSlot: timeSlot as any,
    isInternational,
  };
}

// Helper function to extract team records
function extractTeamRecords(competitor: any, week: number, year: number): {
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;
  conferenceRecord?: string;
  divisionRecord?: string;
  playoffStatus: 'in_contention' | 'clinched_playoffs' | 'clinched_division' | 'clinched_bye' | 'eliminated' | 'meaningless';
} {
  const records = competitor.records || [];
  const totalRecord = records.find((r: any) => r.type === 'total') || records[0] || {};
  
  const wins = parseInt(totalRecord.summary?.split('-')[0] || '0');
  const losses = parseInt(totalRecord.summary?.split('-')[1] || '0');
  const ties = parseInt(totalRecord.summary?.split('-')[2] || '0') || 0;
  const totalGames = wins + losses + ties;
  const winPercentage = totalGames > 0 ? wins / totalGames : 0;

  // Find conference and division records
  const conferenceRecord = records.find((r: any) => r.type === 'vsconf')?.summary;
  const divisionRecord = records.find((r: any) => r.type === 'vsdiv')?.summary;

  // Determine playoff status (simplified for Week 10 - most teams in contention)
  let playoffStatus: 'in_contention' | 'clinched_playoffs' | 'clinched_division' | 'clinched_bye' | 'eliminated' | 'meaningless' = 'in_contention';
  
  if (week <= 10) {
    // Very early in season, almost everyone in contention
    if (wins === 0 && losses >= 8) {
      playoffStatus = 'eliminated'; // Mathematically eliminated
    } else {
      playoffStatus = 'in_contention';
    }
  } else if (week >= 15) {
    // Later in season, check for clinched/eliminated
    // This is simplified - would need more complex logic for actual determination
    if (wins >= 11) {
      playoffStatus = 'clinched_playoffs';
    } else if (losses >= 8) {
      playoffStatus = 'eliminated';
    }
  }

  return {
    wins,
    losses,
    ties,
    winPercentage,
    conferenceRecord,
    divisionRecord,
    playoffStatus,
  };
}

// Helper function to determine game importance
function determineGameImportance(
  awayRecord: ReturnType<typeof extractTeamRecords>,
  homeRecord: ReturnType<typeof extractTeamRecords>,
  week: number
): {
  playoffImplications: boolean;
  divisionRace: boolean;
  byeWeekRace: boolean;
  eliminationGame: boolean;
  notes?: string;
} {
  const bothInContention = 
    awayRecord.playoffStatus === 'in_contention' && 
    homeRecord.playoffStatus === 'in_contention';
  
  const playoffImplications = bothInContention || 
    awayRecord.playoffStatus === 'in_contention' || 
    homeRecord.playoffStatus === 'in_contention';

  // Simplified logic - would need division info for accurate division race
  const divisionRace = false; // Would need to check if teams are in same division
  
  const byeWeekRace = week >= 15 && 
    (awayRecord.playoffStatus === 'clinched_playoffs' || homeRecord.playoffStatus === 'clinched_playoffs');
  
  const eliminationGame = week >= 12 && 
    (awayRecord.playoffStatus === 'in_contention' || homeRecord.playoffStatus === 'in_contention');

  let notes: string | undefined;
  if (week <= 10) {
    notes = 'Early season - most games have playoff implications';
  } else if (bothInContention) {
    notes = 'Both teams in playoff contention';
  }

  return {
    playoffImplications,
    divisionRace,
    byeWeekRace,
    eliminationGame,
    notes,
  };
}

// Helper function to calculate rest days
async function calculateRestDays(
  teamName: string,
  gameTime: Date,
  week: number,
  year: number
): Promise<{ restDays: number; hadByeWeek: boolean }> {
  try {
    // Fetch previous weeks to find last game
    for (let prevWeek = week - 1; prevWeek >= Math.max(1, week - 4); prevWeek--) {
      const scoreboard = await espnApi.getScoreboard(prevWeek, year);
      if (!scoreboard?.events) continue;

      for (const event of scoreboard.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeCompetitor || !awayCompetitor) continue;

        const homeTeam = homeCompetitor.team.displayName;
        const awayTeam = awayCompetitor.team.displayName;

        // Check if this team played in this game
        if (homeTeam === teamName || awayTeam === teamName) {
          // Only count completed games
          if (competition.status?.type?.completed) {
            const lastGameTime = new Date(event.date);
            const restDays = Math.floor((gameTime.getTime() - lastGameTime.getTime()) / (1000 * 60 * 60 * 24));
            return { restDays, hadByeWeek: false };
          }
        }
      }
    }

    // If no previous game found, check if it's after a bye week
    // For Week 10, if no game found in weeks 1-9, team had bye
    if (week > 1) {
      const hadByeWeek = true; // Simplified - would need to check all previous weeks
      // Estimate rest days based on week
      const estimatedRestDays = (week - 1) * 7; // Rough estimate
      return { restDays: estimatedRestDays, hadByeWeek };
    }

    return { restDays: 7, hadByeWeek: false }; // Default to 7 days
  } catch (error) {
    console.warn(`⚠️ Error calculating rest days for ${teamName}:`, error);
    return { restDays: 7, hadByeWeek: false };
  }
}

// Helper function to calculate team performance metrics
async function calculateTeamPerformanceMetrics(
  teamName: string,
  gameTime: Date,
  week: number,
  year: number
): Promise<{
  recentGames: Array<{
    week: number;
    opponent: string;
    pointsScored: number;
    pointsAllowed: number;
    isHome: boolean;
    daysAgo: number;
  }>;
  rollingAverages: {
    last1Game: { pointsScored: number; pointsAllowed: number };
    last2Games: { pointsScored: number; pointsAllowed: number };
    last3Games: { pointsScored: number; pointsAllowed: number };
    last4Games: { pointsScored: number; pointsAllowed: number };
    last5Games: { pointsScored: number; pointsAllowed: number };
    last6Games: { pointsScored: number; pointsAllowed: number };
  };
  seasonAverages: {
    gamesPlayed: number;
    pointsScored: number;
    pointsAllowed: number;
    pointsScoredPerGame: number;
    pointsAllowedPerGame: number;
  };
  weightedAverages: {
    decayFactor: number;
    pointsScored: number;
    pointsAllowed: number;
  };
}> {
  const recentGames: Array<{
    week: number;
    opponent: string;
    pointsScored: number;
    pointsAllowed: number;
    isHome: boolean;
    daysAgo: number;
  }> = [];

  const seasonPointsScored: number[] = [];
  const seasonPointsAllowed: number[] = [];

  // Fetch last 6 games (going back through previous weeks)
  for (let prevWeek = week - 1; prevWeek >= Math.max(1, week - 10) && recentGames.length < 6; prevWeek--) {
    try {
      const scoreboard = await espnApi.getScoreboard(prevWeek, year);
      if (!scoreboard?.events) continue;

      for (const event of scoreboard.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeCompetitor || !awayCompetitor) continue;

        const homeTeam = homeCompetitor.team.displayName;
        const awayTeam = awayCompetitor.team.displayName;
        const homeScore = parseInt(homeCompetitor.score || '0');
        const awayScore = parseInt(awayCompetitor.score || '0');

        // Only include completed games
        if (!competition.status?.type?.completed) continue;

        // Check if this team played in this game
        if (homeTeam === teamName) {
          const lastGameTime = new Date(event.date);
          const daysAgo = Math.floor((gameTime.getTime() - lastGameTime.getTime()) / (1000 * 60 * 60 * 24));
          
          recentGames.push({
            week: prevWeek,
            opponent: awayTeam,
            pointsScored: homeScore,
            pointsAllowed: awayScore,
            isHome: true,
            daysAgo,
          });

          seasonPointsScored.push(homeScore);
          seasonPointsAllowed.push(awayScore);
        } else if (awayTeam === teamName) {
          const lastGameTime = new Date(event.date);
          const daysAgo = Math.floor((gameTime.getTime() - lastGameTime.getTime()) / (1000 * 60 * 60 * 24));
          
          recentGames.push({
            week: prevWeek,
            opponent: homeTeam,
            pointsScored: awayScore,
            pointsAllowed: homeScore,
            isHome: false,
            daysAgo,
          });

          seasonPointsScored.push(awayScore);
          seasonPointsAllowed.push(homeScore);
        }

        if (recentGames.length >= 6) break;
      }
    } catch (error) {
      console.warn(`⚠️ Error fetching Week ${prevWeek} for ${teamName}:`, error);
    }
  }

  // Sort by most recent first
  recentGames.sort((a, b) => b.week - a.week || b.daysAgo - a.daysAgo);

  // Calculate rolling averages
  const calculateRollingAvg = (n: number) => {
    const games = recentGames.slice(0, n);
    if (games.length === 0) return { pointsScored: 0, pointsAllowed: 0 };
    
    const avgScored = games.reduce((sum, g) => sum + g.pointsScored, 0) / games.length;
    const avgAllowed = games.reduce((sum, g) => sum + g.pointsAllowed, 0) / games.length;
    return { pointsScored: avgScored, pointsAllowed: avgAllowed };
  };

  const rollingAverages = {
    last1Game: calculateRollingAvg(1),
    last2Games: calculateRollingAvg(2),
    last3Games: calculateRollingAvg(3),
    last4Games: calculateRollingAvg(4),
    last5Games: calculateRollingAvg(5),
    last6Games: calculateRollingAvg(6),
  };

  // Calculate season averages
  const gamesPlayed = seasonPointsScored.length;
  const seasonAverages = {
    gamesPlayed,
    pointsScored: seasonPointsScored.reduce((sum, p) => sum + p, 0),
    pointsAllowed: seasonPointsAllowed.reduce((sum, p) => sum + p, 0),
    pointsScoredPerGame: gamesPlayed > 0 
      ? seasonPointsScored.reduce((sum, p) => sum + p, 0) / gamesPlayed 
      : 0,
    pointsAllowedPerGame: gamesPlayed > 0
      ? seasonPointsAllowed.reduce((sum, p) => sum + p, 0) / gamesPlayed
      : 0,
  };

  // Calculate weighted averages with exponential decay (decayFactor = 0.8)
  const decayFactor = 0.8;
  let weightedScoredSum = 0;
  let weightedAllowedSum = 0;
  let weightSum = 0;

  recentGames.forEach((game, index) => {
    const weight = Math.pow(decayFactor, index);
    weightedScoredSum += game.pointsScored * weight;
    weightedAllowedSum += game.pointsAllowed * weight;
    weightSum += weight;
  });

  const weightedAverages = {
    decayFactor,
    pointsScored: weightSum > 0 ? weightedScoredSum / weightSum : 0,
    pointsAllowed: weightSum > 0 ? weightedAllowedSum / weightSum : 0,
  };

  return {
    recentGames,
    rollingAverages,
    seasonAverages,
    weightedAverages,
  };
}

// Helper function to fetch historical odds for a date range
async function fetchHistoricalOddsForDateRange(
  dates: string[],
  apiKey: string
): Promise<Array<{ game: any; snapshotTimestamp: string }>> {
  const allOdds: Array<{ game: any; snapshotTimestamp: string }> = [];
  
  for (const dateStr of dates) {
    try {
      // Convert date to timestamp
      const date = new Date(`${dateStr}T18:00:00Z`);
      const minutes = date.getMinutes();
      const roundedMinutes = Math.floor(minutes / 5) * 5;
      date.setMinutes(roundedMinutes);
      date.setSeconds(0);
      date.setMilliseconds(0);
      const timestamp = date.toISOString().replace(/\.\d{3}Z$/, 'Z');

      const response = await fetch(
        `https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl/odds?${new URLSearchParams({
          apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h',
          oddsFormat: 'american',
          bookmakers: 'bovada,draftkings,fanduel',
          date: timestamp,
        })}`
      );

      if (response.ok) {
        const responseData = await response.json();
        // Response structure: { timestamp: "...", data: [...] }
        const snapshotTimestamp = responseData.timestamp || timestamp;
        const data = responseData.data || responseData;
        if (Array.isArray(data)) {
          // Store each game with its snapshot timestamp
          data.forEach((game: any) => {
            allOdds.push({ game, snapshotTimestamp });
          });
        }
      } else if (response.status !== 404) {
        console.warn(`⚠️ Historical odds API returned ${response.status} for ${dateStr}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error fetching historical odds for ${dateStr}:`, error);
    }
  }

  return allOdds;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '10');
    const year = parseInt(searchParams.get('year') || '2023');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    console.log(`📊 Analyzing historical over/under for ${year} Week ${week}...`);

    // Check Firebase cache first
    if (!forceRefresh) {
      const cached = await historicalOverUnderService.getAnalysisForWeek(week, year);
      if (cached) {
        console.log(`💾 Returning cached analysis for ${year} Week ${week}`);
        return NextResponse.json({
          ...cached,
          cached: true,
        });
      }
    }

    // Calculate week boundaries
    const { start, end } = getNFLWeekBoundaries(week, year);
    console.log(`📅 Week boundaries: ${start.toISOString()} to ${end.toISOString()}`);

    // Fetch ESPN scoreboard
    console.log(`📺 Fetching ESPN scoreboard for ${year} Week ${week}...`);
    const espnData = await espnApi.getScoreboard(week, year);
    
    if (!espnData || !espnData.events) {
      return NextResponse.json({
        error: `No ESPN data available for ${year} Week ${week}`,
        week,
        year,
      }, { status: 404 });
    }

    console.log(`✅ Found ${espnData.events.length} ESPN games`);

    // Extract unique dates from actual ESPN game dates (more accurate than week boundaries)
    const gameDates = new Set<string>();
    espnData.events.forEach(event => {
      const gameDate = new Date(event.date);
      gameDates.add(gameDate.toISOString().split('T')[0]);
    });
    
    // Also add dates from week boundaries to catch any odds that might be on different days
    const currentDate = new Date(start);
    while (currentDate <= end) {
      gameDates.add(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const dates = Array.from(gameDates).sort();
    console.log(`📅 Extracted ${dates.length} unique dates from games and week boundaries:`, dates);

    // Fetch historical odds
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'Odds API key not found',
      }, { status: 500 });
    }

    console.log(`📜 Fetching historical odds for ${dates.length} dates...`);
    const historicalOddsWithTimestamps = await fetchHistoricalOddsForDateRange(dates, apiKey);
    console.log(`✅ Found ${historicalOddsWithTimestamps.length} historical odds games`);
    
    // Log sample of odds games for debugging
    if (historicalOddsWithTimestamps.length > 0) {
      const sample = historicalOddsWithTimestamps.slice(0, 3).map(e => ({
        away: e.game.away_team,
        home: e.game.home_team,
        time: e.game.commence_time,
        date: new Date(e.game.commence_time).toISOString().split('T')[0],
      }));
      console.log(`📊 Sample Odds API games:`, sample);
    }

    // Match games and build analysis
    const matchedGames: any[] = [];
    const unmatchedEspnGames: any[] = [];
    const unmatchedOddsGames: any[] = [...historicalOddsWithTimestamps];

    for (const event of espnData.events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) continue;

      const homeTeam = homeCompetitor.team.displayName;
      const awayTeam = awayCompetitor.team.displayName;
      const homeScore = parseInt(homeCompetitor.score || '0');
      const awayScore = parseInt(awayCompetitor.score || '0');
      const totalScore = homeScore + awayScore;

      // Only process completed games
      if (!competition.status?.type?.completed) {
        unmatchedEspnGames.push({
          espnId: event.id,
          awayTeam,
          homeTeam,
          gameTime: event.date,
          status: 'not_completed',
        });
        continue;
      }

      const gameTime = new Date(event.date);
      const gameId = generateGameId(gameTime, awayTeam, homeTeam);
      const readableId = generateReadableGameId(gameTime, awayTeam, homeTeam);

      // Find matching historical odds
      // Try with strict time check first (2 hours), then relaxed (same day only)
      let matchingOddsEntry = historicalOddsWithTimestamps.find((entry: any) => {
        const oddsGame = entry.game;
        const matches = doGamesMatch(
          {
            gameTime,
            awayTeam,
            homeTeam,
          },
          {
            gameTime: oddsGame.commence_time,
            awayTeam: oddsGame.away_team,
            homeTeam: oddsGame.home_team,
          },
          true, // strict time check (2 hours)
          false // debug off for performance
        );
        return matches;
      });
      
      // If no match with strict time check, try with relaxed time check (same day only)
      if (!matchingOddsEntry) {
        matchingOddsEntry = historicalOddsWithTimestamps.find((entry: any) => {
          const oddsGame = entry.game;
          return doGamesMatch(
            {
              gameTime,
              awayTeam,
              homeTeam,
            },
            {
              gameTime: oddsGame.commence_time,
              awayTeam: oddsGame.away_team,
              homeTeam: oddsGame.home_team,
            },
            false // relaxed time check - only check same day
          );
        });
        
        if (matchingOddsEntry) {
          const oddsGame = matchingOddsEntry.game;
          const espnTime = new Date(gameTime);
          const oddsTime = new Date(oddsGame.commence_time);
          const hoursDiff = Math.abs(espnTime.getTime() - oddsTime.getTime()) / (1000 * 60 * 60);
          console.log(`⚠️ Matched with relaxed time check (${hoursDiff.toFixed(1)}h diff): ${awayTeam} @ ${homeTeam}`);
        }
      }
      
      // Log detailed info for first few unmatched games
      if (!matchingOddsEntry && unmatchedEspnGames.length < 5) {
        // Try to find closest match by team names only
        const teamNameMatches = historicalOddsWithTimestamps.filter((entry: any) => {
          const oddsGame = entry.game;
          const away1 = normalizeTeamName(awayTeam);
          const home1 = normalizeTeamName(homeTeam);
          const away2 = normalizeTeamName(oddsGame.away_team);
          const home2 = normalizeTeamName(oddsGame.home_team);
          return (away1 === away2 && home1 === home2) || (away1 === home2 && home1 === away2);
        });
        
        console.log(`🔍 ESPN: ${awayTeam} @ ${homeTeam} at ${gameTime.toISOString()}`);
        console.log(`   Found ${teamNameMatches.length} potential team name matches`);
        if (teamNameMatches.length > 0) {
          teamNameMatches.slice(0, 3).forEach((entry: any) => {
            const oddsGame = entry.game;
            const espnTime = new Date(gameTime);
            const oddsTime = new Date(oddsGame.commence_time);
            const hoursDiff = Math.abs(espnTime.getTime() - oddsTime.getTime()) / (1000 * 60 * 60);
            const sameDay = espnTime.toISOString().split('T')[0] === oddsTime.toISOString().split('T')[0];
            console.log(`   - Odds: ${oddsGame.away_team} @ ${oddsGame.home_team} at ${oddsGame.commence_time}`);
            console.log(`     Time diff: ${hoursDiff.toFixed(1)}h, Same day: ${sameDay}`);
          });
        }
      }

      if (!matchingOddsEntry) {
        unmatchedEspnGames.push({
          espnId: event.id,
          awayTeam,
          homeTeam,
          gameTime: event.date,
          awayScore,
          homeScore,
        });
        continue;
      }

      const matchingOdds = matchingOddsEntry.game;
      const snapshotTimestamp = matchingOddsEntry.snapshotTimestamp;

      // Remove from unmatched list
      const oddsIndex = unmatchedOddsGames.findIndex((entry: any) => entry.game.id === matchingOdds.id);
      if (oddsIndex >= 0) {
        unmatchedOddsGames.splice(oddsIndex, 1);
      }

      // Extract over/under from odds
      const preferredBookmaker = matchingOdds.bookmakers?.find((b: any) =>
        ['bovada', 'draftkings', 'fanduel'].includes(b.key)
      ) || matchingOdds.bookmakers?.[0];

      if (!preferredBookmaker) {
        unmatchedEspnGames.push({
          espnId: event.id,
          awayTeam,
          homeTeam,
          gameTime: event.date,
          awayScore,
          homeScore,
          reason: 'no_bookmaker',
        });
        continue;
      }

      const totalsMarket = preferredBookmaker.markets?.find((m: any) => m.key === 'totals');
      const overOutcome = totalsMarket?.outcomes?.find((o: any) => o.name === 'Over');
      const overUnder = overOutcome?.point;
      const overUnderOdds = overOutcome?.price;

      if (!overUnder) {
        unmatchedEspnGames.push({
          espnId: event.id,
          awayTeam,
          homeTeam,
          gameTime: event.date,
          awayScore,
          homeScore,
          reason: 'no_over_under',
        });
        continue;
      }

      // Calculate result
      const wentOver = totalScore > overUnder;
      const wentUnder = totalScore < overUnder;
      const isPush = totalScore === overUnder;
      const margin = totalScore - overUnder;

      // Extract contextual data
      const weatherData = extractWeatherData(competition);
      const timingData = extractGameTiming(gameTime, competition);
      const awayRecord = extractTeamRecords(awayCompetitor, week, year);
      const homeRecord = extractTeamRecords(homeCompetitor, week, year);
      const gameImportance = determineGameImportance(awayRecord, homeRecord, week);

      // Calculate rest days
      const awayRestDays = await calculateRestDays(awayTeam, gameTime, week, year);
      const homeRestDays = await calculateRestDays(homeTeam, gameTime, week, year);

      // Calculate team performance metrics
      console.log(`📊 Calculating performance metrics for ${awayTeam} and ${homeTeam}...`);
      const awayPerformance = await calculateTeamPerformanceMetrics(awayTeam, gameTime, week, year);
      const homePerformance = await calculateTeamPerformanceMetrics(homeTeam, gameTime, week, year);

      // Calculate combined metrics
      const expectedTotal_last4Games = 
        (awayPerformance.rollingAverages.last4Games.pointsScored +
         homePerformance.rollingAverages.last4Games.pointsScored +
         awayPerformance.rollingAverages.last4Games.pointsAllowed +
         homePerformance.rollingAverages.last4Games.pointsAllowed) / 2;

      const expectedTotal_seasonAvg =
        (awayPerformance.seasonAverages.pointsScoredPerGame +
         homePerformance.seasonAverages.pointsScoredPerGame +
         awayPerformance.seasonAverages.pointsAllowedPerGame +
         homePerformance.seasonAverages.pointsAllowedPerGame) / 2;

      const expectedTotal_weighted =
        (awayPerformance.weightedAverages.pointsScored +
         homePerformance.weightedAverages.pointsScored +
         awayPerformance.weightedAverages.pointsAllowed +
         homePerformance.weightedAverages.pointsAllowed) / 2;

      const matchedGame = {
        gameId,
        readableId,
        espnId: event.id,
        oddsApiId: matchingOdds.id,
        awayTeam,
        homeTeam,
        gameTime: gameTime.toISOString(),
        espnData: {
          awayScore,
          homeScore,
          totalScore,
        },
        historicalOdds: {
          overUnder,
          overUnderOdds,
          bookmaker: preferredBookmaker.key,
          snapshotTimestamp,
        },
        result: {
          wentOver,
          wentUnder,
          margin,
          isPush,
        },
        context: {
          ...weatherData,
          ...timingData,
          awayTeamRecord: awayRecord,
          homeTeamRecord: homeRecord,
          gameImportance,
          restDays: {
            awayTeam: awayRestDays.restDays,
            homeTeam: homeRestDays.restDays,
          },
          byeWeek: {
            awayTeamHadBye: awayRestDays.hadByeWeek,
            homeTeamHadBye: homeRestDays.hadByeWeek,
          },
          teamPerformance: {
            awayTeam: awayPerformance,
            homeTeam: homePerformance,
            combinedMetrics: {
              expectedTotal_last4Games,
              expectedTotal_seasonAvg,
              expectedTotal_weighted,
              // Placeholder for offensive/defensive strength (would need league averages)
              awayOffensiveStrength: 0,
              homeOffensiveStrength: 0,
              awayDefensiveStrength: 0,
              homeDefensiveStrength: 0,
            },
          },
        },
        matchConfidence: 'high' as const,
      };

      matchedGames.push(matchedGame);

      // Store game ID mapping
      try {
        await gameIdMappingService.storeGameIdMapping(gameId, {
          espnId: event.id,
          oddsApiId: matchingOdds.id,
          awayTeam,
          homeTeam,
          gameTime,
        });
      } catch (error) {
        console.warn(`⚠️ Failed to store game ID mapping for ${gameId}:`, error);
      }
    }

    // Calculate summary
    const summary = {
      totalGames: espnData.events.length,
      matchedGames: matchedGames.length,
      overCount: matchedGames.filter(g => g.result.wentOver).length,
      underCount: matchedGames.filter(g => g.result.wentUnder).length,
      pushCount: matchedGames.filter(g => g.result.isPush).length,
    };

    const analysisData = {
      week,
      year,
      weekBoundaries: { start, end },
      games: matchedGames,
      summary,
      unmatchedEspnGames,
      unmatchedOddsGames: unmatchedOddsGames.map((entry: any) => ({
        oddsApiId: entry.game.id,
        awayTeam: entry.game.away_team,
        homeTeam: entry.game.home_team,
        commenceTime: entry.game.commence_time,
      })),
    };

    // Save to Firebase
    try {
      await historicalOverUnderService.saveAnalysisForWeek(week, year, analysisData);
    } catch (error) {
      console.error('❌ Failed to save analysis to Firebase:', error);
      // Continue anyway - return the data even if save fails
    }

    return NextResponse.json({
      ...analysisData,
      cached: false,
      analyzedAt: new Date().toISOString(),
      totalEspnGames: espnData.events.length,
      totalHistoricalOddsGames: historicalOddsWithTimestamps.length,
    });

  } catch (error) {
    console.error('❌ Error analyzing historical over/under:', error);
    return NextResponse.json({
      error: 'Failed to analyze historical over/under',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

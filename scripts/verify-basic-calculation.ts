import { espnApi } from '../lib/espn-api';
import { getCurrentNFLWeek } from '../lib/utils';

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

  console.log(`\n📊 Fetching last ${numGames} games for ${teamName}...`);

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
  }

  return teamStats;
}

function projectTotalPoints(awayStats: TeamStats, homeStats: TeamStats, useMedian: boolean = true): number {
  const awayOffense = useMedian ? awayStats.medianPointsScored : awayStats.avgPointsScored;
  const awayDefense = useMedian ? awayStats.medianPointsAllowed : awayStats.avgPointsAllowed;
  const homeOffense = useMedian ? homeStats.medianPointsScored : homeStats.avgPointsScored;
  const homeDefense = useMedian ? homeStats.medianPointsAllowed : homeStats.avgPointsAllowed;
  
  // BASIC FORMULA - NO ADJUSTMENTS
  const awayExpectedPoints = (awayOffense + homeDefense) / 2;
  const homeExpectedPoints = (homeOffense + awayDefense) / 2;
  const projectedTotal = awayExpectedPoints + homeExpectedPoints;

  return Math.round(projectedTotal * 10) / 10; // Round to 1 decimal
}

async function main() {
  const currentWeek = getCurrentNFLWeek();
  console.log(`\n🔍 VERIFYING BASIC CALCULATIONS FOR WEEK ${currentWeek}`);
  console.log(`================================================\n`);

  const gamesToVerify = [
    { away: 'Atlanta Falcons', home: 'Tampa Bay Buccaneers', line: 44.5, expectedProjection: 52.0 },
    { away: 'Cleveland Browns', home: 'Chicago Bears', line: 41, expectedProjection: 46.0 },
    { away: 'Miami Dolphins', home: 'Pittsburgh Steelers', line: 41.5, expectedProjection: 46.3 },
    { away: 'Buffalo Bills', home: 'New England Patriots', line: 49.5, expectedProjection: 53.8 },
  ];

  for (const game of gamesToVerify) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 ${game.away} @ ${game.home}`);
    console.log(`${'='.repeat(60)}`);

    const [awayStats, homeStats] = await Promise.all([
      getTeamRecentGames(game.away, currentWeek, 4),
      getTeamRecentGames(game.home, currentWeek, 4),
    ]);

    console.log(`\n${game.away} Stats:`);
    console.log(`  Last 4 games:`);
    awayStats.games.forEach(g => {
      console.log(`    Week ${g.week}: vs ${g.opponent} - Scored: ${g.pointsScored}, Allowed: ${g.pointsAllowed} ${g.isHome ? '(H)' : '(A)'}`);
    });
    console.log(`  Mean Points Scored: ${awayStats.avgPointsScored.toFixed(1)} | Median: ${awayStats.medianPointsScored.toFixed(1)}`);
    console.log(`  Mean Points Allowed: ${awayStats.avgPointsAllowed.toFixed(1)} | Median: ${awayStats.medianPointsAllowed.toFixed(1)}`);

    console.log(`\n${game.home} Stats:`);
    console.log(`  Last 4 games:`);
    homeStats.games.forEach(g => {
      console.log(`    Week ${g.week}: vs ${g.opponent} - Scored: ${g.pointsScored}, Allowed: ${g.pointsAllowed} ${g.isHome ? '(H)' : '(A)'}`);
    });
    console.log(`  Mean Points Scored: ${homeStats.avgPointsScored.toFixed(1)} | Median: ${homeStats.medianPointsScored.toFixed(1)}`);
    console.log(`  Mean Points Allowed: ${homeStats.avgPointsAllowed.toFixed(1)} | Median: ${homeStats.medianPointsAllowed.toFixed(1)}`);

    const projectedTotal = projectTotalPoints(awayStats, homeStats, true);
    
    console.log(`\n💡 CALCULATION (MEDIAN):`);
    console.log(`  Away Expected = (${awayStats.medianPointsScored.toFixed(1)} + ${homeStats.medianPointsAllowed.toFixed(1)}) / 2 = ${((awayStats.medianPointsScored + homeStats.medianPointsAllowed) / 2).toFixed(2)}`);
    console.log(`  Home Expected = (${homeStats.medianPointsScored.toFixed(1)} + ${awayStats.medianPointsAllowed.toFixed(1)}) / 2 = ${((homeStats.medianPointsScored + awayStats.medianPointsAllowed) / 2).toFixed(2)}`);
    console.log(`  Projected Total = ${projectedTotal.toFixed(1)}`);
    console.log(`  Bovada Line = ${game.line}`);
    console.log(`  Difference = ${(projectedTotal - game.line).toFixed(1)}`);
    console.log(`  Expected from screenshot = ${game.expectedProjection.toFixed(1)}`);
    console.log(`  Match? ${Math.abs(projectedTotal - game.expectedProjection) < 0.1 ? '✅ YES' : '❌ NO - DIFFERENCE: ' + (projectedTotal - game.expectedProjection).toFixed(1)}`);
  }
}

main().catch(console.error);

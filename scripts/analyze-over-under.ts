/**
 * Standalone script to analyze Over/Under betting lines
 * Run with: npx tsx scripts/analyze-over-under.ts [week]
 */

import { getCurrentNFLWeek } from '../lib/utils';
import { espnApi } from '../lib/espn-api';

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
  difference: number;
  recommendation: 'over' | 'under' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
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
    
    console.log(`    ✅ Found ${games.length} games:`);
    games.forEach(game => {
      console.log(`       Week ${game.week}: ${game.isHome ? 'vs' : '@'} ${game.opponent} - ${game.pointsScored}-${game.pointsAllowed} (${game.isHome ? 'W' : 'L'})`);
    });
    console.log(`    📈 Mean Points Scored: ${teamStats.avgPointsScored.toFixed(1)} | Median: ${teamStats.medianPointsScored.toFixed(1)}`);
    console.log(`    📉 Mean Points Allowed: ${teamStats.avgPointsAllowed.toFixed(1)} | Median: ${teamStats.medianPointsAllowed.toFixed(1)}`);
  } else {
    console.log(`    ⚠️ No games found for ${teamName}`);
  }

  return teamStats;
}

function projectTotalPoints(awayStats: TeamStats, homeStats: TeamStats, useMedian: boolean = false): number {
  const awayOffense = useMedian ? awayStats.medianPointsScored : awayStats.avgPointsScored;
  const awayDefense = useMedian ? awayStats.medianPointsAllowed : awayStats.avgPointsAllowed;
  const homeOffense = useMedian ? homeStats.medianPointsScored : homeStats.avgPointsScored;
  const homeDefense = useMedian ? homeStats.medianPointsAllowed : homeStats.avgPointsAllowed;
  
  const awayExpectedPoints = (awayOffense + homeDefense) / 2;
  const homeExpectedPoints = (homeOffense + awayDefense) / 2;
  const projectedTotal = awayExpectedPoints + homeExpectedPoints;
  const homeFieldAdvantage = 2.5;
  const adjustedTotal = projectedTotal + (homeFieldAdvantage * 0.5);
  return Math.round(adjustedTotal * 10) / 10;
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
    });
  }

  return games;
}

async function main() {
  const weekArg = process.argv[2];
  const currentWeek = weekArg ? parseInt(weekArg) : getCurrentNFLWeek();
  
  console.log(`\n🏈 OVER/UNDER ANALYSIS FOR WEEK ${currentWeek}\n`);
  console.log(`📅 Today: ${new Date().toLocaleDateString()}\n`);

  // Get current week's games with betting lines
  const games = await fetchGamesDirectly(currentWeek);

  if (games.length === 0) {
    console.error('❌ No games found for this week');
    process.exit(1);
  }

  console.log(`📊 Found ${games.length} games for Week ${currentWeek}\n`);
  console.log('=' .repeat(80));

  const analyses: GameAnalysis[] = [];

  for (const game of games) {
    console.log(`\n📈 ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`   🕐 ${game.gameTime.toLocaleString()}`);
    console.log(`   🎰 Bovada O/U: ${game.overUnder || 'N/A'}\n`);

    const [awayStats, homeStats] = await Promise.all([
      getTeamRecentGames(game.awayTeam, currentWeek, 4),
      getTeamRecentGames(game.homeTeam, currentWeek, 4),
    ]);

    const projectedTotalMean = projectTotalPoints(awayStats, homeStats, false);
    const projectedTotalMedian = projectTotalPoints(awayStats, homeStats, true);
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
    });

    console.log(`\n   💡 PROJECTION:`);
    console.log(`      Mean Projection: ${projectedTotalMean.toFixed(1)} | Median Projection: ${projectedTotalMedian.toFixed(1)}`);
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

    console.log('\n' + '='.repeat(80));
  }

  // Summary
  console.log('\n\n📊 SUMMARY\n');
  console.log(`Total Games: ${analyses.length}`);
  console.log(`Games with Lines: ${analyses.filter(a => a.bovadaOverUnder).length}`);
  console.log(`High Confidence Bets: ${analyses.filter(a => a.confidence === 'high' && a.bovadaOverUnder).length}`);
  console.log(`Medium Confidence Bets: ${analyses.filter(a => a.confidence === 'medium' && a.bovadaOverUnder).length}`);

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
    });
  }
}

main().catch(console.error);

/**
 * Analyze whether games with teams coming off bye weeks have different total points
 * than games where neither team is off bye.
 * 
 * Run with: npx tsx scripts/analyze-bye-week-totals.ts [startWeek] [endWeek]
 * Example: npx tsx scripts/analyze-bye-week-totals.ts 2 18
 */

import { espnApi } from '../lib/espn-api';

interface GameAnalysis {
  week: number;
  awayTeam: string;
  homeTeam: string;
  totalPoints: number;
  awayOffBye: boolean;
  homeOffBye: boolean;
  bothOffBye: boolean;
  oneOffBye: boolean;
  neitherOffBye: boolean;
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

async function analyzeByeWeekTotals(startWeek: number = 2, endWeek: number = 18) {
  console.log(`\n📊 Analyzing Bye Week Impact on Total Points`);
  console.log(`📅 Weeks ${startWeek}-${endWeek}\n`);
  
  const games: GameAnalysis[] = [];
  
  // Fetch all games from specified weeks
  for (let week = startWeek; week <= endWeek; week++) {
    console.log(`📈 Fetching Week ${week}...`);
    
    try {
      const scoreboard = await espnApi.getScoreboard(week);
      if (!scoreboard || !scoreboard.events) {
        console.log(`   ⚠️ No games found for Week ${week}`);
        continue;
      }
      
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
        
        // Only analyze completed games
        if (!competition.status.type.completed) {
          console.log(`   ⏭️ Skipping incomplete game: ${awayTeam} @ ${homeTeam}`);
          continue;
        }
        
        const totalPoints = homeScore + awayScore;
        
        // Check if teams are coming off bye
        const [awayOffBye, homeOffBye] = await Promise.all([
          isComingOffBye(awayTeam, week),
          isComingOffBye(homeTeam, week),
        ]);
        
        const bothOffBye = awayOffBye && homeOffBye;
        const oneOffBye = (awayOffBye || homeOffBye) && !bothOffBye;
        const neitherOffBye = !awayOffBye && !homeOffBye;
        
        games.push({
          week,
          awayTeam,
          homeTeam,
          totalPoints,
          awayOffBye,
          homeOffBye,
          bothOffBye,
          oneOffBye,
          neitherOffBye,
        });
        
        console.log(`   ✅ ${awayTeam} @ ${homeTeam}: ${totalPoints} pts (Away bye: ${awayOffBye}, Home bye: ${homeOffBye})`);
      }
    } catch (error) {
      console.error(`❌ Error fetching Week ${week}:`, error);
    }
  }
  
  console.log(`\n📊 Analysis Results:\n`);
  console.log(`Total games analyzed: ${games.length}\n`);
  
  // Categorize games
  const bothByeGames = games.filter(g => g.bothOffBye);
  const oneByeGames = games.filter(g => g.oneOffBye);
  const neitherByeGames = games.filter(g => g.neitherOffBye);
  const anyByeGames = games.filter(g => g.awayOffBye || g.homeOffBye);
  
  // Calculate averages
  const avgBothBye = bothByeGames.length > 0
    ? bothByeGames.reduce((sum, g) => sum + g.totalPoints, 0) / bothByeGames.length
    : 0;
  
  const avgOneBye = oneByeGames.length > 0
    ? oneByeGames.reduce((sum, g) => sum + g.totalPoints, 0) / oneByeGames.length
    : 0;
  
  const avgNeitherBye = neitherByeGames.length > 0
    ? neitherByeGames.reduce((sum, g) => sum + g.totalPoints, 0) / neitherByeGames.length
    : 0;
  
  const avgAnyBye = anyByeGames.length > 0
    ? anyByeGames.reduce((sum, g) => sum + g.totalPoints, 0) / anyByeGames.length
    : 0;
  
  // Display results
  console.log('='.repeat(80));
  console.log('📈 BYE WEEK IMPACT ON TOTAL POINTS\n');
  
  console.log(`Games with BOTH teams off bye: ${bothByeGames.length}`);
  console.log(`   Average total points: ${avgBothBye.toFixed(2)}`);
  console.log(`   Range: ${Math.min(...bothByeGames.map(g => g.totalPoints))} - ${Math.max(...bothByeGames.map(g => g.totalPoints))}`);
  
  console.log(`\nGames with ONE team off bye: ${oneByeGames.length}`);
  console.log(`   Average total points: ${avgOneBye.toFixed(2)}`);
  console.log(`   Range: ${Math.min(...oneByeGames.map(g => g.totalPoints))} - ${Math.max(...oneByeGames.map(g => g.totalPoints))}`);
  
  console.log(`\nGames with NEITHER team off bye: ${neitherByeGames.length}`);
  console.log(`   Average total points: ${avgNeitherBye.toFixed(2)}`);
  console.log(`   Range: ${Math.min(...neitherByeGames.map(g => g.totalPoints))} - ${Math.max(...neitherByeGames.map(g => g.totalPoints))}`);
  
  console.log(`\nGames with ANY team off bye: ${anyByeGames.length}`);
  console.log(`   Average total points: ${avgAnyBye.toFixed(2)}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPARISON\n');
  
  const diffBothVsNeither = avgBothBye - avgNeitherBye;
  const diffOneVsNeither = avgOneBye - avgNeitherBye;
  const diffAnyVsNeither = avgAnyBye - avgNeitherBye;
  
  console.log(`Both teams off bye vs Neither: ${diffBothVsNeither > 0 ? '+' : ''}${diffBothVsNeither.toFixed(2)} points`);
  console.log(`One team off bye vs Neither: ${diffOneVsNeither > 0 ? '+' : ''}${diffOneVsNeither.toFixed(2)} points`);
  console.log(`Any team off bye vs Neither: ${diffAnyVsNeither > 0 ? '+' : ''}${diffAnyVsNeither.toFixed(2)} points`);
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 CONCLUSION\n');
  
  if (Math.abs(diffAnyVsNeither) < 1) {
    console.log('✅ Bye weeks appear to have MINIMAL impact on total points.');
    console.log('   The difference is less than 1 point, suggesting bye weeks');
    console.log('   affect win probability more than total scoring.');
  } else if (diffAnyVsNeither > 0) {
    console.log(`📈 Games with bye week teams score ${diffAnyVsNeither.toFixed(2)} points MORE on average.`);
    console.log('   This suggests teams off bye may play more aggressively or');
    console.log('   have better offensive execution that outweighs defensive improvement.');
  } else {
    console.log(`📉 Games with bye week teams score ${Math.abs(diffAnyVsNeither).toFixed(2)} points LESS on average.`);
    console.log('   This suggests teams off bye may play more conservatively or');
    console.log('   have better defensive preparation that outweighs offensive improvement.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const startWeek = process.argv[2] ? parseInt(process.argv[2]) : 2;
  const endWeek = process.argv[3] ? parseInt(process.argv[3]) : 18;
  
  if (isNaN(startWeek) || isNaN(endWeek) || startWeek < 1 || endWeek > 18 || startWeek > endWeek) {
    console.error('❌ Invalid week range. Usage: npx tsx scripts/analyze-bye-week-totals.ts [startWeek] [endWeek]');
    process.exit(1);
  }
  
  await analyzeByeWeekTotals(startWeek, endWeek);
}

main().catch(console.error);

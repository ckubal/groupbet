/**
 * Check results of ALL Week 14 O/U bets by confidence level
 */

import { espnApi } from '../lib/espn-api';

interface Bet {
  game: string;
  bovadaLine: number;
  bet: 'OVER' | 'UNDER';
  confidence: 'high' | 'medium' | 'low';
  projectedTotal: number;
  edge: number;
}

async function checkAllBets() {
  const week = 14;
  console.log(`\n🏈 WEEK ${week} BET RESULTS - ALL CONFIDENCE LEVELS\n`);
  
  const espnData = await espnApi.getScoreboard(week);
  if (!espnData || !espnData.events) {
    console.error('No data available');
    return;
  }

  // All bets we recommended
  const allBets: Bet[] = [
    // HIGH CONFIDENCE
    { game: 'Tennessee Titans at Cleveland Browns', bovadaLine: 34, bet: 'OVER', confidence: 'high', projectedTotal: 43.8, edge: 9.8 },
    { game: 'Los Angeles Rams at Arizona Cardinals', bovadaLine: 47.5, bet: 'OVER', confidence: 'high', projectedTotal: 56.0, edge: 8.5 },
    { game: 'Seattle Seahawks at Atlanta Falcons', bovadaLine: 44.5, bet: 'OVER', confidence: 'high', projectedTotal: 52.5, edge: 8.0 },
    
    // MEDIUM CONFIDENCE
    { game: 'New Orleans Saints at Tampa Bay Buccaneers', bovadaLine: 42, bet: 'OVER', confidence: 'medium', projectedTotal: 45.5, edge: 3.5 },
    { game: 'Houston Texans at Kansas City Chiefs', bovadaLine: 41.5, bet: 'OVER', confidence: 'medium', projectedTotal: 44.3, edge: 2.8 },
    { game: 'Philadelphia Eagles at Los Angeles Chargers', bovadaLine: 41.5, bet: 'UNDER', confidence: 'medium', projectedTotal: 38.8, edge: -2.7 },
    
    // LOW CONFIDENCE / NEUTRAL
    { game: 'Washington Commanders at Minnesota Vikings', bovadaLine: 43.5, bet: 'OVER', confidence: 'low', projectedTotal: 44.5, edge: 1.0 },
    { game: 'Miami Dolphins at New York Jets', bovadaLine: 41, bet: 'UNDER', confidence: 'low', projectedTotal: 40.0, edge: -1.0 },
    { game: 'Denver Broncos at Las Vegas Raiders', bovadaLine: 40.5, bet: 'UNDER', confidence: 'low', projectedTotal: 39.5, edge: -1.0 },
    { game: 'Chicago Bears at Green Bay Packers', bovadaLine: 44, bet: 'UNDER', confidence: 'low', projectedTotal: 42.5, edge: -1.5 },
  ];

  const results = {
    high: [] as Array<{ bet: Bet; currentTotal: number; status: string; final: boolean }>,
    medium: [] as Array<{ bet: Bet; currentTotal: number; status: string; final: boolean }>,
    low: [] as Array<{ bet: Bet; currentTotal: number; status: string; final: boolean }>,
  };

  for (const bet of allBets) {
    const event = espnData.events.find(e => e.name === bet.game);
    if (!event) {
      console.log(`⚠️ ${bet.game} - Game not found`);
      continue;
    }

    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
    
    const homeScore = parseInt(homeTeam?.score || '0');
    const awayScore = parseInt(awayTeam?.score || '0');
    const total = homeScore + awayScore;
    
    const isFinal = competition.status.type.completed;
    const status = competition.status.type.description;
    
    let result: 'winning' | 'losing' | 'pending' = 'pending';
    if (isFinal) {
      if (bet.bet === 'OVER') {
        result = total > bet.bovadaLine ? 'winning' : 'losing';
      } else {
        result = total < bet.bovadaLine ? 'winning' : 'losing';
      }
    } else {
      // Game in progress
      if (bet.bet === 'OVER') {
        result = total > bet.bovadaLine ? 'winning' : 'pending';
      } else {
        result = total < bet.bovadaLine ? 'winning' : 'pending';
      }
    }

    const resultData = {
      bet,
      currentTotal: total,
      status: result,
      final: isFinal,
    };

    if (bet.confidence === 'high') {
      results.high.push(resultData);
    } else if (bet.confidence === 'medium') {
      results.medium.push(resultData);
    } else {
      results.low.push(resultData);
    }
  }

  // Print results by category
  console.log('🟢 HIGH CONFIDENCE BETS (3):\n');
  let highWins = 0, highLosses = 0, highPending = 0;
  results.high.forEach((r, i) => {
    const emoji = r.status === 'winning' ? '✅' : r.status === 'losing' ? '❌' : '⏳';
    const finalText = r.final ? 'FINAL' : 'IN PROGRESS';
    console.log(`${emoji} ${i + 1}. ${r.bet.game}`);
    console.log(`   Bet: ${r.bet.bet} ${r.bet.bovadaLine} | Projected: ${r.bet.projectedTotal} | Edge: ${r.bet.edge > 0 ? '+' : ''}${r.bet.edge}`);
    console.log(`   Current Total: ${r.currentTotal} (${finalText})`);
    console.log(`   Status: ${r.status.toUpperCase()}\n`);
    
    if (r.status === 'winning') highWins++;
    else if (r.status === 'losing') highLosses++;
    else highPending++;
  });
  console.log(`📊 High Confidence: ${highWins}W-${highLosses}L-${highPending}P\n`);

  console.log('🟡 MEDIUM CONFIDENCE BETS (3):\n');
  let medWins = 0, medLosses = 0, medPending = 0;
  results.medium.forEach((r, i) => {
    const emoji = r.status === 'winning' ? '✅' : r.status === 'losing' ? '❌' : '⏳';
    const finalText = r.final ? 'FINAL' : 'IN PROGRESS';
    console.log(`${emoji} ${i + 1}. ${r.bet.game}`);
    console.log(`   Bet: ${r.bet.bet} ${r.bet.bovadaLine} | Projected: ${r.bet.projectedTotal} | Edge: ${r.bet.edge > 0 ? '+' : ''}${r.bet.edge}`);
    console.log(`   Current Total: ${r.currentTotal} (${finalText})`);
    console.log(`   Status: ${r.status.toUpperCase()}\n`);
    
    if (r.status === 'winning') medWins++;
    else if (r.status === 'losing') medLosses++;
    else medPending++;
  });
  console.log(`📊 Medium Confidence: ${medWins}W-${medLosses}L-${medPending}P\n`);

  console.log('🔴 LOW CONFIDENCE / NEUTRAL BETS (4):\n');
  let lowWins = 0, lowLosses = 0, lowPending = 0;
  results.low.forEach((r, i) => {
    const emoji = r.status === 'winning' ? '✅' : r.status === 'losing' ? '❌' : '⏳';
    const finalText = r.final ? 'FINAL' : 'IN PROGRESS';
    console.log(`${emoji} ${i + 1}. ${r.bet.game}`);
    console.log(`   Bet: ${r.bet.bet} ${r.bet.bovadaLine} | Projected: ${r.bet.projectedTotal} | Edge: ${r.bet.edge > 0 ? '+' : ''}${r.bet.edge}`);
    console.log(`   Current Total: ${r.currentTotal} (${finalText})`);
    console.log(`   Status: ${r.status.toUpperCase()}\n`);
    
    if (r.status === 'winning') lowWins++;
    else if (r.status === 'losing') lowLosses++;
    else lowPending++;
  });
  console.log(`📊 Low Confidence: ${lowWins}W-${lowLosses}L-${lowPending}P\n`);

  // Overall summary
  const totalWins = highWins + medWins + lowWins;
  const totalLosses = highLosses + medLosses + lowLosses;
  const totalPending = highPending + medPending + lowPending;
  
  console.log('='.repeat(60));
  console.log('📊 OVERALL SUMMARY:\n');
  console.log(`🟢 High Confidence: ${highWins}W-${highLosses}L-${highPending}P`);
  console.log(`🟡 Medium Confidence: ${medWins}W-${medLosses}L-${medPending}P`);
  console.log(`🔴 Low Confidence: ${lowWins}W-${lowLosses}L-${lowPending}P`);
  console.log(`\n📈 TOTAL: ${totalWins}W-${totalLosses}L-${totalPending}P`);
  
  if (totalWins + totalLosses > 0) {
    const winRate = ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1);
    console.log(`📊 Win Rate: ${winRate}% (${totalWins}/${totalWins + totalLosses} completed)`);
  }
}

checkAllBets().catch(console.error);

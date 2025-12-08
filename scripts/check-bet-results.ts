/**
 * Check results of Week 14 O/U bets
 */

import { espnApi } from '../lib/espn-api';

interface BetResult {
  game: string;
  bovadaLine: number;
  currentTotal: number;
  status: 'winning' | 'losing' | 'pending';
  recommendation: string;
}

async function checkBetResults() {
  const week = 14;
  console.log(`\n🏈 CHECKING WEEK ${week} BET RESULTS\n`);
  
  const espnData = await espnApi.getScoreboard(week);
  if (!espnData || !espnData.events) {
    console.error('No data available');
    return;
  }

  // Our top 3 bets
  const bets = [
    { game: 'Tennessee Titans at Cleveland Browns', line: 34, bet: 'OVER' },
    { game: 'Los Angeles Rams at Arizona Cardinals', line: 47.5, bet: 'OVER' },
    { game: 'Seattle Seahawks at Atlanta Falcons', line: 44.5, bet: 'OVER' },
  ];

  console.log('📊 TOP 3 HIGH CONFIDENCE BETS:\n');

  for (const bet of bets) {
    const event = espnData.events.find(e => e.name === bet.game);
    if (!event) {
      console.log(`❌ ${bet.game} - Game not found`);
      continue;
    }

    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
    
    const homeScore = parseInt(homeTeam?.score || '0');
    const awayScore = parseInt(awayTeam?.score || '0');
    const total = homeScore + awayScore;
    
    const status = competition.status.type.description;
    const isFinal = competition.status.type.completed;
    
    let result: 'winning' | 'losing' | 'pending' = 'pending';
    if (isFinal) {
      if (bet.bet === 'OVER') {
        result = total > bet.line ? 'winning' : 'losing';
      } else {
        result = total < bet.line ? 'winning' : 'losing';
      }
    } else {
      // Game in progress
      if (bet.bet === 'OVER') {
        result = total > bet.line ? 'winning' : 'pending';
      } else {
        result = total < bet.line ? 'winning' : 'pending';
      }
    }

    const emoji = result === 'winning' ? '✅' : result === 'losing' ? '❌' : '⏳';
    const statusText = isFinal ? 'FINAL' : status;
    
    console.log(`${emoji} ${bet.game}`);
    console.log(`   Bet: ${bet.bet} ${bet.line}`);
    console.log(`   Score: ${awayTeam?.team.displayName} ${awayScore} - ${homeTeam?.team.displayName} ${homeScore}`);
    console.log(`   Total: ${total} (${statusText})`);
    console.log(`   Status: ${result.toUpperCase()}`);
    
    // Check weather if available
    const weather = (competition as any).weather;
    if (weather) {
      console.log(`   🌤️ Weather: ${weather.displayValue || 'N/A'}`);
      if (weather.temperature) {
        console.log(`   🌡️ Temperature: ${weather.temperature}°F`);
      }
      if (weather.windSpeed) {
        console.log(`   💨 Wind: ${weather.windSpeed} mph`);
      }
    } else {
      console.log(`   🌤️ Weather: Not available (likely indoor or not yet reported)`);
    }
    
    console.log('');
  }

  // Check venue info for indoor/outdoor
  console.log('\n🏟️ VENUE INFO:\n');
  for (const bet of bets) {
    const event = espnData.events.find(e => e.name === bet.game);
    if (event) {
      const venue = event.competitions[0].venue;
      const indoor = venue?.indoor ? '🏟️ INDOOR' : '🌤️ OUTDOOR';
      console.log(`${bet.game}: ${venue?.fullName || 'Unknown'} - ${indoor}`);
    }
  }
}

checkBetResults().catch(console.error);

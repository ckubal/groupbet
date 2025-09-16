import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';

export async function POST(request: NextRequest) {
  console.log('🎯 Starting bet resolution based on actual game results...');
  
  try {
    // Get all Week 2 games with actual results
    const games = await oddsApi.getNFLGames(2, true); // Force refresh to get latest data
    console.log(`🏈 Retrieved ${games.length} games for bet resolution`);
    
    // Get all bets for Week 2 2025 (both active and potentially misresolved)
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-2')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`🎰 Found ${betsSnapshot.docs.length} bets to resolve`);
    
    let resolvedCount = 0;
    const resolutions: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      const game = games.find(g => g.id === bet.gameId);
      
      if (!game) {
        console.log(`⚠️  No game found for bet ${betDoc.id} with gameId: ${bet.gameId}`);
        continue;
      }
      
      if (game.status !== 'final') {
        console.log(`⏳ Game ${game.awayTeam} @ ${game.homeTeam} not final yet, skipping bet resolution`);
        continue;
      }
      
      if (bet.status !== 'active') {
        console.log(`✅ Bet ${betDoc.id} already resolved as ${bet.status}, skipping`);
        continue;
      }
      
      let betResult = 'unknown';
      let resultDescription = '';
      
      console.log(`\n🔍 Resolving bet: ${bet.betType.toUpperCase()} - ${bet.selection}`);
      console.log(`   Game: ${game.awayTeam} @ ${game.homeTeam} (Final: ${game.awayScore}-${game.homeScore})`);
      
      // Resolve based on bet type
      if (bet.betType === 'moneyline') {
        const homeScore = game.homeScore || 0;
        const awayScore = game.awayScore || 0;
        const homeWon = homeScore > awayScore;
        const awayWon = awayScore > homeScore;
        
        // Check if bet selection matches the winning team
        const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase()) || 
                         bet.selection.toLowerCase().includes('ml') && bet.selection.toLowerCase().includes(game.homeTeam.split(' ').pop()?.toLowerCase() || '');
        const betOnAway = bet.selection.toLowerCase().includes(game.awayTeam.toLowerCase()) || 
                         bet.selection.toLowerCase().includes('ml') && bet.selection.toLowerCase().includes(game.awayTeam.split(' ').pop()?.toLowerCase() || '');
        
        console.log(`   🎯 Moneyline analysis: betOnHome=${betOnHome}, betOnAway=${betOnAway}, homeWon=${homeWon}, awayWon=${awayWon}`);
        
        if ((betOnHome && homeWon) || (betOnAway && awayWon)) {
          betResult = 'won';
          resultDescription = homeWon ? `${game.homeTeam} won ${homeScore}-${awayScore}` : `${game.awayTeam} won ${awayScore}-${homeScore}`;
        } else {
          betResult = 'lost';
          resultDescription = homeWon ? `${game.homeTeam} won ${homeScore}-${awayScore}` : `${game.awayTeam} won ${awayScore}-${homeScore}`;
        }
      } 
      else if (bet.betType === 'spread') {
        const homeScore = game.homeScore || 0;
        const awayScore = game.awayScore || 0;
        const line = bet.line || 0;
        
        // Determine which team the bet is on
        const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase());
        const betOnAway = bet.selection.toLowerCase().includes(game.awayTeam.toLowerCase());
        
        console.log(`   🎯 Spread analysis: line=${line}, homeScore=${homeScore}, awayScore=${awayScore}, betOnHome=${betOnHome}, betOnAway=${betOnAway}`);
        
        if (betOnHome) {
          // Betting on home team with the spread
          const homeAdjustedScore = homeScore + line;
          const homeCovers = homeAdjustedScore > awayScore;
          betResult = homeCovers ? 'won' : 'lost';
          resultDescription = `${game.homeTeam} ${homeCovers ? 'covered' : 'did not cover'} ${line >= 0 ? '+' : ''}${line} (${homeScore}-${awayScore})`;
        } else if (betOnAway) {
          // Betting on away team with the spread
          // The line stored is from the bet selection, so use it directly
          const awayAdjustedScore = awayScore + line;
          const awayCovers = awayAdjustedScore > homeScore;
          betResult = awayCovers ? 'won' : 'lost';
          resultDescription = `${game.awayTeam} ${awayCovers ? 'covered' : 'did not cover'} ${line >= 0 ? '+' : ''}${line} (${awayScore}-${homeScore})`;
        }
      }
      else if (bet.betType === 'player_prop' && game.playerStats) {
        // Find the player in the game stats
        const playerName = bet.playerName || extractPlayerNameFromSelection(bet.selection);
        const playerStat = game.playerStats.find(stat => 
          stat.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(stat.playerName.toLowerCase())
        );
        
        if (playerStat) {
          const isOver = bet.selection.toLowerCase().includes('over');
          const line = bet.line || extractLineFromSelection(bet.selection);
          let actualValue = 0;
          
          // Determine which stat to check
          if (bet.selection.toLowerCase().includes('receiving')) {
            actualValue = playerStat.receivingYards || 0;
          } else if (bet.selection.toLowerCase().includes('rushing')) {
            actualValue = playerStat.rushingYards || 0;
          } else if (bet.selection.toLowerCase().includes('passing')) {
            actualValue = playerStat.passingYards || 0;
          }
          
          console.log(`   📊 ${playerName}: ${actualValue} yards (line: ${line})`);
          
          if (isOver) {
            betResult = actualValue > line ? 'won' : 'lost';
            resultDescription = `${playerName}: ${actualValue} yards (needed over ${line})`;
          } else {
            betResult = actualValue < line ? 'won' : 'lost';
            resultDescription = `${playerName}: ${actualValue} yards (needed under ${line})`;
          }
        } else {
          console.log(`⚠️  Player stats not found for ${playerName}`);
          betResult = 'unknown';
          resultDescription = 'Player stats not available';
        }
      }
      
      // Update the bet in Firebase
      if (betResult !== 'unknown') {
        await updateDoc(doc(db, 'bets', betDoc.id), {
          status: betResult,
          result: resultDescription,
          resolvedAt: new Date()
        });
        
        resolutions.push({
          betId: betDoc.id,
          betDescription: `${bet.betType.toUpperCase()} - ${bet.selection}`,
          result: betResult,
          resultDescription,
          game: `${game.awayTeam} @ ${game.homeTeam}`,
          finalScore: `${game.awayScore || 0}-${game.homeScore || 0}`
        });
        
        resolvedCount++;
        console.log(`   ✅ Resolved as ${betResult.toUpperCase()}: ${resultDescription}`);
      }
    }
    
    console.log(`\n🎉 Resolution complete! Resolved ${resolvedCount} bet(s)`);
    
    return NextResponse.json({
      success: true,
      resolvedCount,
      resolutions,
      message: `Successfully resolved ${resolvedCount} bet(s) based on actual game results`
    });
    
  } catch (error) {
    console.error('❌ Bet resolution failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function extractPlayerNameFromSelection(selection: string): string {
  // Extract player name from selections like "DeAndre Hopkins Over 19.5 receiving yards"
  const parts = selection.split(' ');
  const overUnderIndex = parts.findIndex(part => part.toLowerCase() === 'over' || part.toLowerCase() === 'under');
  if (overUnderIndex > 0) {
    return parts.slice(0, overUnderIndex).join(' ');
  }
  return selection;
}

function extractLineFromSelection(selection: string): number {
  // Extract line from selections like "DeAndre Hopkins Over 19.5 receiving yards"
  const match = selection.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}
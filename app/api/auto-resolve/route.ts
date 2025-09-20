import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  console.log('🤖 AUTO-RESOLVE: Starting automatic bet resolution process...');
  
  try {
    // Get current week
    const currentWeek = getCurrentNFLWeek();
    const weekendId = `2025-week-${currentWeek}`;
    
    console.log(`📅 Processing bets for ${weekendId}`);
    
    // Get all games for current week with fresh data
    const games = await oddsApi.getNFLGames(currentWeek, true);
    console.log(`🏈 Retrieved ${games.length} games for week ${currentWeek}`);
    
    // Get all active bets for current week
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', weekendId),
      where('status', '==', 'active')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`🎰 Found ${betsSnapshot.docs.length} active bets to check`);
    
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
        console.log(`⏳ Game ${game.awayTeam} @ ${game.homeTeam} not final yet (status: ${game.status})`);
        continue;
      }
      
      console.log(`\n🔍 Resolving bet: ${bet.betType.toUpperCase()} - ${bet.selection}`);
      console.log(`   Game: ${game.awayTeam} @ ${game.homeTeam} (Final: ${game.awayScore}-${game.homeScore})`);
      
      let betResult = 'unknown';
      let resultDescription = '';
      
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
          continue; // Don't mark as unknown, just skip for now
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
    
    console.log(`\n🎉 Auto-resolution complete! Resolved ${resolvedCount} bet(s)`);
    
    // If any bets were resolved, also update the in-play amounts
    if (resolvedCount > 0) {
      console.log('💰 Updating settlement calculations...');
      // Could trigger settlement recalculation here if needed
    }
    
    return NextResponse.json({
      success: true,
      resolvedCount,
      resolutions,
      message: `Successfully resolved ${resolvedCount} bet(s)`,
      nextCheckIn: '1 hour'
    });
    
  } catch (error) {
    console.error('❌ Auto-resolve failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function extractPlayerNameFromSelection(selection: string): string {
  const parts = selection.split(' ');
  const overUnderIndex = parts.findIndex(part => part.toLowerCase() === 'over' || part.toLowerCase() === 'under');
  if (overUnderIndex > 0) {
    return parts.slice(0, overUnderIndex).join(' ');
  }
  return selection;
}

function extractLineFromSelection(selection: string): number {
  const match = selection.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

// This endpoint can be called by:
// 1. A cron job (e.g., Vercel cron, GitHub Actions, external service)
// 2. Manually via GET request
// 3. From the frontend on page load
// 4. Via a webhook from ESPN when game status changes
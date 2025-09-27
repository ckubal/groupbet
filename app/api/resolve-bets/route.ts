import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function POST(request: NextRequest) {
  console.log('🎯 Starting bet resolution based on actual game results...');
  
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    // Get current week games with actual results
    const games = await oddsApi.getNFLGames(weekNumber, true); // Force refresh to get latest data
    console.log(`🏈 Retrieved ${games.length} games for Week ${weekNumber} bet resolution`);
    
    // Get only ACTIVE bets for specified week
    const weekendId = `2025-week-${weekNumber}`;
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', weekendId),
      where('status', '==', 'active')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`🎰 Found ${betsSnapshot.docs.length} bets to resolve`);
    
    let resolvedCount = 0;
    const resolutions: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      
      let game: any = null;
      
      // Handle parlay bets differently - they don't have a single gameId
      if (bet.betType === 'parlay') {
        console.log(`🎰 Processing parlay bet ${betDoc.id} with ${bet.parlayLegs?.length || 0} legs`);
        // Parlay logic will be handled separately below
      } else {
        game = games.find(g => g.id === bet.gameId);
        
        if (!game) {
          console.log(`⚠️  No game found for bet ${betDoc.id} with gameId: ${bet.gameId}`);
          continue;
        }
        
        if (game.status !== 'final') {
          console.log(`⏳ Game ${game.awayTeam} @ ${game.homeTeam} not final yet, skipping bet resolution`);
          continue;
        }
      }
      
      if (bet.status !== 'active') {
        console.log(`✅ Bet ${betDoc.id} already resolved as ${bet.status}, skipping`);
        continue;
      }
      
      let betResult = 'unknown';
      let resultDescription = '';
      let updatedParlayLegs: any[] = [];
      
      console.log(`\n🔍 Resolving bet: ${bet.betType.toUpperCase()} - ${bet.selection}`);
      if (bet.betType !== 'parlay') {
        console.log(`   Game: ${game.awayTeam} @ ${game.homeTeam} (Final: ${game.awayScore}-${game.homeScore})`);
      }
      
      // Resolve based on bet type
      if (bet.betType === 'parlay') {
        // Handle parlay bets - all legs must be complete to resolve
        if (!bet.parlayLegs || bet.parlayLegs.length === 0) {
          console.log(`⚠️  Parlay bet ${betDoc.id} has no legs defined`);
          continue;
        }
        
        let allLegsComplete = true;
        let anyLegLost = false;
        const legResults: any[] = [];
        updatedParlayLegs = [...bet.parlayLegs]; // Copy for updating
        
        // Check each leg of the parlay
        for (let i = 0; i < bet.parlayLegs.length; i++) {
          const leg = bet.parlayLegs[i];
          const legGame = games.find(g => g.id === leg.gameId);
          
          if (!legGame || legGame.status !== 'final') {
            allLegsComplete = false;
            console.log(`⏳ Parlay leg for game ${leg.gameId} not complete yet`);
            break;
          }
          
          // Determine if this leg won or lost using existing logic
          let legWon = false;
          let legResult = '';
          
          if (leg.betType === 'moneyline') {
            const homeScore = legGame.homeScore || 0;
            const awayScore = legGame.awayScore || 0;
            const homeWon = homeScore > awayScore;
            const betOnHome = leg.selection.toLowerCase().includes(legGame.homeTeam.toLowerCase());
            const betOnAway = leg.selection.toLowerCase().includes(legGame.awayTeam.toLowerCase());
            
            legWon = (betOnHome && homeWon) || (betOnAway && !homeWon);
            legResult = `${leg.selection} - ${legWon ? 'WON' : 'LOST'} (${awayScore}-${homeScore})`;
          }
          else if (leg.betType === 'spread') {
            const homeScore = legGame.homeScore || 0;
            const awayScore = legGame.awayScore || 0;
            const line = leg.line || 0;
            const betOnHome = leg.selection.toLowerCase().includes(legGame.homeTeam.toLowerCase());
            
            if (betOnHome) {
              const homeAdjustedScore = homeScore + line;
              legWon = homeAdjustedScore > awayScore;
            } else {
              const awayAdjustedScore = awayScore + line;
              legWon = awayAdjustedScore > homeScore;
            }
            legResult = `${leg.selection} - ${legWon ? 'WON' : 'LOST'} (${awayScore}-${homeScore})`;
          }
          else if (leg.betType === 'over_under') {
            const totalPoints = (legGame.homeScore || 0) + (legGame.awayScore || 0);
            const line = leg.line || 0;
            const isOver = leg.selection.toLowerCase().includes('over');
            
            legWon = isOver ? (totalPoints > line) : (totalPoints < line);
            legResult = `${leg.selection} - ${legWon ? 'WON' : 'LOST'} (${totalPoints} points)`;
          }
          
          // Update the leg status in the copy
          updatedParlayLegs[i].status = legWon ? 'won' : 'lost';
          
          legResults.push(legResult);
          
          if (!legWon) {
            anyLegLost = true;
            console.log(`   ❌ Parlay leg lost: ${legResult}`);
          } else {
            console.log(`   ✅ Parlay leg won: ${legResult}`);
          }
        }
        
        if (!allLegsComplete) {
          // Not all games are final yet
          continue;
        }
        
        // All legs are complete - determine parlay outcome
        if (anyLegLost) {
          betResult = 'lost';
          resultDescription = `Parlay lost - ${legResults.join('; ')}`;
        } else {
          betResult = 'won';
          resultDescription = `Parlay won! - ${legResults.join('; ')}`;
        }
      }
      else if (bet.betType === 'moneyline') {
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
      else if (bet.betType === 'over_under') {
        const homeScore = game.homeScore || 0;
        const awayScore = game.awayScore || 0;
        const totalPoints = homeScore + awayScore;
        const line = bet.line || 0;
        
        console.log(`   🎯 Over/Under analysis: total=${totalPoints}, line=${line}, selection=${bet.selection}`);
        
        const isOver = bet.selection.toLowerCase().includes('over');
        
        if (isOver) {
          // Over bet
          const overWins = totalPoints > line;
          betResult = overWins ? 'won' : 'lost';
          resultDescription = `Total ${totalPoints} points (needed over ${line})`;
        } else {
          // Under bet  
          const underWins = totalPoints < line;
          betResult = underWins ? 'won' : 'lost';
          resultDescription = `Total ${totalPoints} points (needed under ${line})`;
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
        const playerStat = game.playerStats.find((stat: any) => 
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
        const updateData: any = {
          status: betResult,
          result: resultDescription,
          resolvedAt: new Date()
        };
        
        // Include updated parlay legs with individual statuses for parlay bets
        if (bet.betType === 'parlay' && updatedParlayLegs) {
          updateData.parlayLegs = updatedParlayLegs;
        }
        
        await updateDoc(doc(db, 'bets', betDoc.id), updateData);
        
        resolutions.push({
          betId: betDoc.id,
          betDescription: `${bet.betType.toUpperCase()} - ${bet.selection}`,
          result: betResult,
          resultDescription,
          game: bet.betType === 'parlay' ? `${bet.parlayLegs?.length || 0}-leg parlay` : `${game.awayTeam} @ ${game.homeTeam}`,
          finalScore: bet.betType === 'parlay' ? 'Multiple games' : `${game.awayScore || 0}-${game.homeScore || 0}`
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
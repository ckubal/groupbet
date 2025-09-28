import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { gamesCacheService } from '@/lib/games-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function POST(request: NextRequest) {
  console.log('🔄 Auto-resolve: Starting automatic bet resolution...');
  
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    // Get current week and also check the previous week for any late-resolving bets
    const currentWeek = getCurrentNFLWeek();
    const weeksToCheck = week ? 
      [parseInt(week)] : 
      [currentWeek - 1, currentWeek, currentWeek + 1].filter(w => w >= 1 && w <= 18);
    
    console.log(`🏈 Auto-resolve: Checking weeks ${weeksToCheck.join(', ')} for completed games`);
    
    let totalResolved = 0;
    const allResolutions: any[] = [];
    
    for (const week of weeksToCheck) {
      console.log(`\n🔍 Auto-resolve: Processing Week ${week}...`);
      
      // Get games with force refresh to ensure latest data
      const games = await gamesCacheService.getGamesForWeek(week, true);
      const finalGames = games.filter(g => g.status === 'final');
      
      console.log(`🏁 Auto-resolve: Found ${finalGames.length} completed games in Week ${week}`);
      
      if (finalGames.length === 0) {
        continue;
      }
      
      // Get only ACTIVE bets for this week
      const weekendId = `2025-week-${week}`;
      const betsQuery = query(
        collection(db, 'bets'),
        where('weekendId', '==', weekendId),
        where('status', '==', 'active')
      );
      
      const betsSnapshot = await getDocs(betsQuery);
      console.log(`🎰 Auto-resolve: Found ${betsSnapshot.docs.length} active bets for Week ${week}`);
      
      for (const betDoc of betsSnapshot.docs) {
        const bet = betDoc.data();
        let game: any = null;
        
        // Handle parlay bets differently - they don't have a single gameId
        if (bet.betType === 'parlay') {
          console.log(`🎰 Auto-resolve: Processing parlay bet ${betDoc.id} with ${bet.parlayLegs?.length || 0} legs`);
          // Check if all parlay legs are from completed games
          if (!bet.parlayLegs || bet.parlayLegs.length === 0) {
            console.log(`⚠️  Auto-resolve: Parlay bet ${betDoc.id} has no legs defined`);
            continue;
          }
          
          let allLegsComplete = true;
          for (const leg of bet.parlayLegs) {
            const legGame = games.find(g => g.id === leg.gameId);
            if (!legGame || legGame.status !== 'final') {
              allLegsComplete = false;
              break;
            }
          }
          
          if (!allLegsComplete) {
            console.log(`⏳ Auto-resolve: Not all parlay legs are complete yet`);
            continue;
          }
        } else {
          game = games.find(g => g.id === bet.gameId);
          
          if (!game) {
            console.log(`⚠️  Auto-resolve: No game found for bet ${betDoc.id} with gameId: ${bet.gameId}`);
            continue;
          }
          
          if (game.status !== 'final') {
            console.log(`⏳ Auto-resolve: Game ${game.awayTeam} @ ${game.homeTeam} not final yet`);
            continue;
          }
        }
        
        // Now resolve the bet using the existing resolution logic
        console.log(`✅ Auto-resolve: Resolving bet ${betDoc.id} - ${bet.betType} - ${bet.selection}`);
        
        let betResult = 'unknown';
        let resultDescription = '';
        let updatedParlayLegs: any[] = [];
        
        // Use the same resolution logic from the manual resolve-bets endpoint
        if (bet.betType === 'parlay') {
          // Parlay resolution logic
          let allLegsComplete = true;
          let anyLegLost = false;
          const legResults: any[] = [];
          updatedParlayLegs = [...bet.parlayLegs];
          
          for (let i = 0; i < bet.parlayLegs.length; i++) {
            const leg = bet.parlayLegs[i];
            const legGame = games.find(g => g.id === leg.gameId);
            
            if (!legGame || legGame.status !== 'final') {
              allLegsComplete = false;
              break;
            }
            
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
            
            updatedParlayLegs[i].status = legWon ? 'won' : 'lost';
            legResults.push(legResult);
            
            if (!legWon) {
              anyLegLost = true;
            }
          }
          
          if (allLegsComplete) {
            betResult = anyLegLost ? 'lost' : 'won';
            resultDescription = anyLegLost ? 
              `Parlay lost - ${legResults.join('; ')}` : 
              `Parlay won! - ${legResults.join('; ')}`;
          }
        }
        else if (bet.betType === 'moneyline') {
          const homeScore = game.homeScore || 0;
          const awayScore = game.awayScore || 0;
          const homeWon = homeScore > awayScore;
          const awayWon = awayScore > homeScore;
          
          const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase()) || 
                           (bet.selection.toLowerCase().includes('ml') && bet.selection.toLowerCase().includes(game.homeTeam.split(' ').pop()?.toLowerCase() || ''));
          const betOnAway = bet.selection.toLowerCase().includes(game.awayTeam.toLowerCase()) || 
                           (bet.selection.toLowerCase().includes('ml') && bet.selection.toLowerCase().includes(game.awayTeam.split(' ').pop()?.toLowerCase() || ''));
          
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
          
          const isOver = bet.selection.toLowerCase().includes('over');
          
          if (isOver) {
            const overWins = totalPoints > line;
            betResult = overWins ? 'won' : 'lost';
            resultDescription = `Total ${totalPoints} points (needed over ${line})`;
          } else {
            const underWins = totalPoints < line;
            betResult = underWins ? 'won' : 'lost';
            resultDescription = `Total ${totalPoints} points (needed under ${line})`;
          }
        }
        else if (bet.betType === 'spread') {
          const homeScore = game.homeScore || 0;
          const awayScore = game.awayScore || 0;
          const line = bet.line || 0;
          
          const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase());
          const betOnAway = bet.selection.toLowerCase().includes(game.awayTeam.toLowerCase());
          
          if (betOnHome) {
            const homeAdjustedScore = homeScore + line;
            const homeCovers = homeAdjustedScore > awayScore;
            betResult = homeCovers ? 'won' : 'lost';
            resultDescription = `${game.homeTeam} ${homeCovers ? 'covered' : 'did not cover'} ${line >= 0 ? '+' : ''}${line} (${homeScore}-${awayScore})`;
          } else if (betOnAway) {
            const awayAdjustedScore = awayScore + line;
            const awayCovers = awayAdjustedScore > homeScore;
            betResult = awayCovers ? 'won' : 'lost';
            resultDescription = `${game.awayTeam} ${awayCovers ? 'covered' : 'did not cover'} ${line >= 0 ? '+' : ''}${line} (${awayScore}-${homeScore})`;
          }
        }
        else if (bet.betType === 'player_prop' && game.playerStats) {
          const playerName = bet.playerName || extractPlayerNameFromSelection(bet.selection);
          const playerStat = game.playerStats.find((stat: any) => 
            stat.playerName.toLowerCase().includes(playerName.toLowerCase()) ||
            playerName.toLowerCase().includes(stat.playerName.toLowerCase())
          );
          
          if (playerStat) {
            const isOver = bet.selection.toLowerCase().includes('over');
            const line = bet.line || extractLineFromSelection(bet.selection);
            let actualValue = 0;
            
            if (bet.selection.toLowerCase().includes('receiving')) {
              actualValue = playerStat.receivingYards || 0;
            } else if (bet.selection.toLowerCase().includes('rushing')) {
              actualValue = playerStat.rushingYards || 0;
            } else if (bet.selection.toLowerCase().includes('passing')) {
              actualValue = playerStat.passingYards || 0;
            }
            
            if (isOver) {
              betResult = actualValue > line ? 'won' : 'lost';
              resultDescription = `${playerName}: ${actualValue} yards (needed over ${line})`;
            } else {
              betResult = actualValue < line ? 'won' : 'lost';
              resultDescription = `${playerName}: ${actualValue} yards (needed under ${line})`;
            }
          } else {
            console.log(`⚠️  Auto-resolve: Player stats not found for ${playerName}`);
            betResult = 'unknown';
            resultDescription = 'Player stats not available';
          }
        }
        
        // Update the bet in Firebase if we have a result
        if (betResult !== 'unknown') {
          const updateData: any = {
            status: betResult,
            result: resultDescription,
            resolvedAt: new Date()
          };
          
          // Save game data to the bet for future reference
          if (game) {
            updateData.gameData = {
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              status: game.status,
              gameTime: game.gameTime
            };
          }
          
          if (bet.betType === 'parlay' && updatedParlayLegs) {
            updateData.parlayLegs = updatedParlayLegs;
          }
          
          await updateDoc(doc(db, 'bets', betDoc.id), updateData);
          
          allResolutions.push({
            betId: betDoc.id,
            betDescription: `${bet.betType.toUpperCase()} - ${bet.selection}`,
            result: betResult,
            resultDescription,
            game: bet.betType === 'parlay' ? `${bet.parlayLegs?.length || 0}-leg parlay` : `${game.awayTeam} @ ${game.homeTeam}`,
            finalScore: bet.betType === 'parlay' ? 'Multiple games' : `${game.awayScore || 0}-${game.homeScore || 0}`
          });
          
          totalResolved++;
          console.log(`✅ Auto-resolve: Resolved bet ${betDoc.id} as ${betResult.toUpperCase()}: ${resultDescription}`);
        }
      }
    }
    
    console.log(`\n🎉 Auto-resolve: Complete! Resolved ${totalResolved} bet(s) across ${weeksToCheck.length} weeks`);
    
    return NextResponse.json({
      success: true,
      resolvedCount: totalResolved,
      resolutions: allResolutions,
      weeksChecked: weeksToCheck,
      message: `Auto-resolved ${totalResolved} bet(s) based on completed games`
    });
    
  } catch (error) {
    console.error('❌ Auto-resolve failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions (same as in resolve-bets)
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
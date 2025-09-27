import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { gamesCacheService } from '@/lib/games-cache';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting Week 3 game ID fix...');
    
    // Get all Week 3 games from the system
    const games = await gamesCacheService.getGamesForWeek(3, true);
    console.log(`📋 Found ${games.length} games in Week 3`);
    
    // Create a mapping of team matchups to game IDs
    const gameMapping: Record<string, string> = {};
    games.forEach(game => {
      // Create multiple keys for matching flexibility
      const key1 = `${game.awayTeam}@${game.homeTeam}`.toLowerCase();
      const key2 = `${game.homeTeam}vs${game.awayTeam}`.toLowerCase();
      const key3 = `${game.awayTeam}vs${game.homeTeam}`.toLowerCase();
      
      gameMapping[key1] = game.id;
      gameMapping[key2] = game.id;
      gameMapping[key3] = game.id;
      
      // Also map by just team names for player props
      if (game.awayTeam.includes('Chiefs') || game.homeTeam.includes('Chiefs')) {
        gameMapping['chiefs'] = game.id;
      }
      if (game.awayTeam.includes('Ravens') || game.homeTeam.includes('Ravens')) {
        gameMapping['ravens'] = game.id;
      }
      if (game.awayTeam.includes('Vikings') || game.homeTeam.includes('Vikings')) {
        gameMapping['vikings'] = game.id;
      }
      if (game.awayTeam.includes('Bengals') || game.homeTeam.includes('Bengals')) {
        gameMapping['bengals'] = game.id;
      }
    });
    
    // Get all Week 3 bets
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-3')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`📊 Found ${betsSnapshot.docs.length} Week 3 bets to check`);
    
    let fixedCount = 0;
    const fixes: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      const currentGameId = bet.gameId;
      
      // Check if this game ID exists in our current games
      const gameExists = games.some(g => g.id === currentGameId);
      
      if (!gameExists) {
        console.log(`❌ Bet ${betDoc.id} has invalid gameId: ${currentGameId}`);
        console.log(`   Selection: ${bet.selection}`);
        
        // Try to find the correct game ID based on the bet selection
        let newGameId: string | null = null;
        const selection = bet.selection.toLowerCase();
        
        // Check for specific team mentions in the selection
        if (selection.includes('chiefs') || selection.includes('eagles')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Chiefs') || g.homeTeam.includes('Chiefs')) &&
            (g.awayTeam.includes('Eagles') || g.homeTeam.includes('Eagles'))
          )?.id || null;
        } else if (selection.includes('vikings') || selection.includes('bengals')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Vikings') || g.homeTeam.includes('Vikings')) &&
            (g.awayTeam.includes('Bengals') || g.homeTeam.includes('Bengals'))
          )?.id || null;
        } else if (selection.includes('packers') || selection.includes('browns')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Packers') || g.homeTeam.includes('Packers')) &&
            (g.awayTeam.includes('Browns') || g.homeTeam.includes('Browns'))
          )?.id || null;
        } else if (selection.includes('steelers') || selection.includes('patriots')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Steelers') || g.homeTeam.includes('Steelers')) &&
            (g.awayTeam.includes('Patriots') || g.homeTeam.includes('Patriots'))
          )?.id || null;
        } else if (selection.includes('dolphins') || selection.includes('bills')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Dolphins') || g.homeTeam.includes('Dolphins')) &&
            (g.awayTeam.includes('Bills') || g.homeTeam.includes('Bills'))
          )?.id || null;
        } else if (selection.includes('commanders') || selection.includes('washington')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Commanders') || g.homeTeam.includes('Commanders')) ||
            (g.awayTeam.includes('Packers') || g.homeTeam.includes('Packers'))
          )?.id || null;
        } else if (selection.includes('jaguars') || selection.includes('jacksonville')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Jaguars') || g.homeTeam.includes('Jaguars'))
          )?.id || null;
        } else if (selection.includes('49ers') || selection.includes('san francisco')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('49ers') || g.homeTeam.includes('49ers'))
          )?.id || null;
        } else if (selection.includes('seahawks')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Seahawks') || g.homeTeam.includes('Seahawks'))
          )?.id || null;
        } else if (selection.includes('raiders')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Raiders') || g.homeTeam.includes('Raiders'))
          )?.id || null;
        } else if (selection.includes('lions')) {
          newGameId = games.find(g => 
            (g.awayTeam.includes('Lions') || g.homeTeam.includes('Lions'))
          )?.id || null;
        }
        
        // For player props (Kelce, Hopkins, Brown)
        if (bet.betType === 'player_prop') {
          if (selection.includes('kelce')) {
            newGameId = games.find(g => 
              g.awayTeam.includes('Chiefs') || g.homeTeam.includes('Chiefs')
            )?.id || null;
          } else if (selection.includes('hopkins')) {
            newGameId = games.find(g => 
              g.awayTeam.includes('Ravens') || g.homeTeam.includes('Ravens')
            )?.id || null;
          } else if (selection.includes('brown') && selection.includes('under')) {
            newGameId = games.find(g => 
              g.awayTeam.includes('Chiefs') || g.homeTeam.includes('Chiefs')
            )?.id || null;
          }
        }
        
        if (newGameId) {
          console.log(`✅ Found correct gameId for bet ${betDoc.id}: ${newGameId}`);
          
          await updateDoc(doc(db, 'bets', betDoc.id), {
            gameId: newGameId,
            gameIdFixed: true,
            originalGameId: currentGameId
          });
          
          fixes.push({
            betId: betDoc.id,
            selection: bet.selection,
            oldGameId: currentGameId,
            newGameId: newGameId
          });
          
          fixedCount++;
        } else {
          console.log(`⚠️  Could not find matching game for bet: ${bet.selection}`);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} bet(s) with incorrect game IDs`,
      totalBetsChecked: betsSnapshot.docs.length,
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error fixing game IDs:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
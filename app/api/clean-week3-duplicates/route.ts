import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Cleaning ALL Week 3 duplicate games...');
    
    // Get all games for Week 3
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', '2025-week-3')
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} games for Week 3`);
    
    // Group games by team matchup to identify duplicates
    const gamesByMatchup = new Map<string, any[]>();
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      const matchupKey = `${game.awayTeam} @ ${game.homeTeam}`;
      
      if (!gamesByMatchup.has(matchupKey)) {
        gamesByMatchup.set(matchupKey, []);
      }
      
      gamesByMatchup.get(matchupKey)!.push({
        id: gameDoc.id,
        ...game
      });
    }
    
    console.log(`🔍 Found ${gamesByMatchup.size} unique matchups`);
    
    let deletedCount = 0;
    const fixes: any[] = [];
    
    // Process each unique matchup
    for (const [matchupKey, games] of gamesByMatchup) {
      console.log(`\n🏈 Processing: ${matchupKey} (${games.length} copies)`);
      
      if (games.length === 1) {
        console.log(`   ✓ No duplicates found`);
        continue;
      }
      
      // Find the "best" game (prefer one with proper gameTime Firebase timestamp)
      const bestGame = games.reduce((best, current) => {
        // Prefer game with proper Firebase timestamp
        if (current.gameTime && current.gameTime.seconds && (!best.gameTime || !best.gameTime.seconds)) {
          return current;
        }
        // Prefer game with more complete data
        if ((current.playerProps?.length || 0) > (best.playerProps?.length || 0)) {
          return current;
        }
        return best;
      });
      
      console.log(`   📌 Best game ID: ${bestGame.id}`);
      console.log(`   📊 Has gameTime: ${!!(bestGame.gameTime && bestGame.gameTime.seconds)}`);
      console.log(`   📊 Has espnId: ${!!bestGame.espnId}`);
      
      // Merge data from duplicates into the best game
      const duplicates = games.filter(g => g.id !== bestGame.id);
      
      for (const duplicate of duplicates) {
        console.log(`   🔄 Merging data from duplicate ${duplicate.id}`);
        
        // Prepare update data by merging missing fields
        const updateData: any = {};
        
        if (!bestGame.gameTime && duplicate.gameTime) {
          updateData.gameTime = duplicate.gameTime;
          console.log(`     ➕ Adding gameTime`);
        }
        if (!bestGame.espnId && duplicate.espnId) {
          updateData.espnId = duplicate.espnId;
          console.log(`     ➕ Adding espnId: ${duplicate.espnId}`);
        }
        if (!bestGame.readableId && duplicate.readableId) {
          updateData.readableId = duplicate.readableId;
          console.log(`     ➕ Adding readableId: ${duplicate.readableId}`);
        }
        if ((!bestGame.playerProps || bestGame.playerProps.length === 0) && 
            duplicate.playerProps && duplicate.playerProps.length > 0) {
          updateData.playerProps = duplicate.playerProps;
          console.log(`     ➕ Adding ${duplicate.playerProps.length} player props`);
        }
        
        // Update the best game if we have data to merge
        if (Object.keys(updateData).length > 0) {
          await updateDoc(doc(db, 'games', bestGame.id), {
            ...updateData,
            cleanedUpAt: new Date()
          });
          console.log(`     ✅ Updated ${bestGame.id} with merged data`);
        }
        
        // Delete the duplicate
        console.log(`   🗑️ Deleting duplicate: ${duplicate.id}`);
        await deleteDoc(doc(db, 'games', duplicate.id));
        deletedCount++;
      }
      
      fixes.push({
        matchup: matchupKey,
        keptGame: bestGame.id,
        deletedGames: duplicates.map(d => d.id),
        deletedCount: duplicates.length
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned Week 3: deleted ${deletedCount} duplicate games`,
      summary: {
        totalGamesBefore: gamesSnapshot.docs.length,
        uniqueMatchups: gamesByMatchup.size,
        expectedGames: 16,
        duplicatesDeleted: deletedCount,
        totalGamesAfter: gamesByMatchup.size
      },
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
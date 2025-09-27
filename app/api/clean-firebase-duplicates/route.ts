import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '3');
    
    console.log(`🧹 Cleaning duplicate games for Week ${week}...`);
    
    // Get all games for the specified week
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', `2025-week-${week}`)
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} total documents for Week ${week}`);
    
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
    let mergedCount = 0;
    const cleanupActions: any[] = [];
    
    // Process each unique matchup
    for (const [matchupKey, games] of gamesByMatchup) {
      console.log(`\n🏈 Processing: ${matchupKey} (${games.length} copies)`);
      console.log(`   Game IDs: ${games.map(g => g.id).join(', ')}`);
      
      if (games.length === 1) {
        console.log(`✓ ${matchupKey} - No duplicates`);
        continue;
      }
      
      // Find the best game to keep (using same logic as fix-all-week4-times)
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
      console.log(`   📊 Best game has gameTime: ${!!(bestGame.gameTime && bestGame.gameTime.seconds)}`);
      console.log(`   📊 Best game has espnId: ${!!bestGame.espnId}`);
      
      // Delete duplicate games (keep only the best one)
      const duplicates = games.filter(g => g.id !== bestGame.id);
      console.log(`   🔍 Found ${duplicates.length} duplicates to delete`);
      
      for (const duplicate of duplicates) {
        console.log(`   🗑️ Deleting duplicate: ${duplicate.id}`);
        
        // First, merge any missing data from duplicate into best game
        const updateData: any = {};
        let needsUpdate = false;
        
        if (!bestGame.gameTime && duplicate.gameTime) {
          updateData.gameTime = duplicate.gameTime;
          needsUpdate = true;
          console.log(`     🔄 Will add gameTime from ${duplicate.id}`);
        }
        if (!bestGame.espnId && duplicate.espnId) {
          updateData.espnId = duplicate.espnId;
          needsUpdate = true;
          console.log(`     🔄 Will add espnId from ${duplicate.id}`);
        }
        if (!bestGame.readableId && duplicate.readableId) {
          updateData.readableId = duplicate.readableId;
          needsUpdate = true;
          console.log(`     🔄 Will add readableId from ${duplicate.id}`);
        }
        
        // Update best game if needed
        if (needsUpdate) {
          await updateDoc(doc(db, 'games', bestGame.id), updateData);
          console.log(`     ✅ Updated ${bestGame.id} with data from ${duplicate.id}`);
        }
        
        // Delete the duplicate
        await deleteDoc(doc(db, 'games', duplicate.id));
        deletedCount++;
        
        cleanupActions.push({
          action: 'deleted',
          gameId: duplicate.id,
          matchup: matchupKey,
          reason: 'Duplicate of ' + bestGame.id
        });
      }
      
      if (duplicates.length > 0) {
        mergedCount++;
        cleanupActions.push({
          action: 'merged',
          gameId: bestGame.id,
          matchup: matchupKey,
          mergedFrom: duplicates.map(d => d.id)
        });
        console.log(`   ✅ Merged ${duplicates.length} duplicates into ${bestGame.id}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned Week ${week}: merged ${mergedCount} games and deleted ${deletedCount} duplicates`,
      summary: {
        totalDocumentsBefore: gamesSnapshot.docs.length,
        uniqueMatchups: gamesByMatchup.size,
        expectedGames: 16,
        duplicatesDeleted: deletedCount,
        gamesMerged: mergedCount,
        totalDocumentsAfter: gamesByMatchup.size
      },
      cleanupActions
    });
    
  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
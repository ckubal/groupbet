import { NextRequest, NextResponse } from 'next/server';
import { doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Force deleting Week 3 duplicates using exact Firebase IDs...');
    
    // Based on audit results, these are the duplicate game IDs to delete
    // Keep the ones with espnId and readableId (better data), delete the others
    const duplicatesToDelete = [
      '23vR52TsAB14rusZuBpn',      // Atlanta @ Carolina (keep 0253c5773c7c0f81a917f251e9fbf066)
      'HAsVOxftlDSJzmwFBhRf',      // Saints @ Seahawks (keep 0d0a7a1b1286f55e20807cfc97a8c77c)
      'gyewigThzaqgqgmyiIAA',      // Cowboys @ Bears (keep 122fb21dd02542985c93bc2922afb373)
      'l8n3qKF3Rcl5Gh5W6kZl',      // Texans @ Jaguars (keep 40f0e01792f7cd1a652369cbd31ff513)
      'a3dt2meffMIvfYlj7g3D',      // Jets @ Bucs (keep 41869945806d331592679c37aa53acf2)
      'BlRskSUph4JEyfb07M4Z',      // Packers @ Browns (keep 44b485590b2af1e7e63ca5397f986f88)
      'zE2JN5u9xp5nA7mJMuMU',      // Broncos @ Chargers (keep 48b6f1cb0148bc7e3ba2e251219d237c)
      'Ikm7O4lOEPL30WSk484k',      // Colts @ Titans (keep 578ffef2b9bd6bbb7583da7b119ea95a)
      'i6oE5p8EKWBYxCCIkXpm',      // Dolphins @ Bills (keep 5cde40c04cbd9bf79e635cf26907a4b4)
      'RKdMyO2rUXDCeJZrhNH2',      // Bengals @ Vikings (keep 89401d2624c7a7ca9667252fb8f6049c)
      'f8t110sFSF9XJJhW6ONE',      // Cardinals @ 49ers (keep 8debb377329b6156763e4c8473f1cb26)
      'FwzSgQWxgv7al8Gx7VtK',      // Raiders @ Commanders (keep e078d00462b84d53487188659c6e7b75)
      'IJubfjdN2NDOCXA2p80B',      // Chiefs @ Giants (keep eb481205d478f654835594acded077f3)
      'YPbcmSyxrEHIL5k0T5wz',      // Rams @ Eagles (keep f3e11ada14ef15de967d39ea6cd3ed96)
      'iTmfym8jTDz59yfo7dNp',      // Steelers @ Patriots (keep b35cd562772cde48af17b82ec57579fc)
      'w4SfINwc9qM35XZGDYDb'       // Lions @ Ravens (keep f50f9a1e6886ce5ab292edabf0315f7e)
    ];
    
    let deletedCount = 0;
    const deletionResults = [];
    
    for (const gameId of duplicatesToDelete) {
      try {
        // Check if document exists first
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        
        if (!gameDoc.exists()) {
          console.log(`⚠️ Game ${gameId} already deleted or doesn't exist`);
          deletionResults.push({
            gameId,
            status: 'already_deleted',
            message: 'Document does not exist'
          });
          continue;
        }
        
        const gameData = gameDoc.data();
        console.log(`🗑️ Deleting duplicate: ${gameId} (${gameData.awayTeam} @ ${gameData.homeTeam})`);
        
        // Delete the duplicate
        await deleteDoc(doc(db, 'games', gameId));
        deletedCount++;
        
        deletionResults.push({
          gameId,
          matchup: `${gameData.awayTeam} @ ${gameData.homeTeam}`,
          status: 'deleted',
          message: 'Successfully deleted duplicate'
        });
        
      } catch (error) {
        console.error(`❌ Error deleting ${gameId}:`, error);
        deletionResults.push({
          gameId,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Force deleted ${deletedCount} duplicate games from Week 3`,
      deletedCount,
      expectedDeletions: duplicatesToDelete.length,
      deletionResults
    });
    
  } catch (error) {
    console.error('❌ Error force deleting duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
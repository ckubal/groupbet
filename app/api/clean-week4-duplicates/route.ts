import { NextRequest, NextResponse } from 'next/server';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Force deleting Week 4 duplicates using exact Firebase IDs...');
    
    // Based on audit results, these are duplicate IDs to delete (keep ones with espnId/readableId)
    const duplicatesToDelete = [
      '0FmOAMjRnXOGBBE1odF5',      // Bears @ Raiders (keep 9e9ee9e12f449474aa5267319034b91f)
      'FSoLvKfyzABnkJQhCDPg',      // Eagles @ Bucs (keep 1c9accd7c9e833e5dfe0750ed5fb0afb)
      '5uuPYp2COCX6u3azLr9R',      // Panthers @ Patriots (keep 1efaa8149688c1a9ea83326c23083446)
      'b23Q6VroTG6EaTMGxhso',      // Packers @ Cowboys (keep 2102e00ce698e2158d3bd5070b7f834f)
      'PozH49W5XXSg5NZhsrR8',      // Titans @ Texans (keep 5595ec6c03a65532df4a954e2cbdde07)
      'BDbRvQZeoav0AtegFRIC',      // Colts @ Rams (keep 77cf7b03fee78721739f7c56597a2377)
      'csvs5HAnaawu0N0GPw1M',      // Seahawks @ Cardinals (keep 81ee3cae5619c3f2d41acba05c6a985a)
      'Ao2xe0zjxzpUzkFz8It6',      // Jaguars @ 49ers (keep fa45d581b92a328aa0069cfe7d28b02f)
      'DsJaESDiAAV70VlPOeka',      // Browns @ Lions (keep baebc1799b887ad1c1200968c654e2a4)
      'KYK8lmbUBeup2Z2SbZoR',      // Ravens @ Chiefs (keep bb4380ec57ee25f61cb197c14d3879f7)
      'MfzPwrBUbM2ih1pD3qTJ',      // Vikings @ Steelers (keep df7edcdb51731dddd57bafb54a6b042d)
      'OHBAZ7K3aRkKpaDGpuZO',      // Saints @ Bills (keep c974365df465f722f31d4a533e6ab54f)
      'WyiCEuym6lFaoJO7cfiI',      // Jets @ Dolphins (keep da8ef5f08abacc1a3cb54a084c5c9f3f)
      'jHNo6VQnkJOZxMxeiPUz',      // Chargers @ Giants (keep c25707a76e96185fbb59be00a7de3aa0)
      'rrcC6vi2KXSy7bu3xbGl',      // Commanders @ Falcons (keep f033f66be3bd001d559f49844fd1244f)
      'wAfVhA0yIjGDGKVXvQSw'       // Bengals @ Broncos (keep f2b458b5f639fa53e4c0dded33f84cd4)
    ];
    
    let deletedCount = 0;
    const deletionResults = [];
    
    for (const gameId of duplicatesToDelete) {
      try {
        console.log(`🗑️ Deleting duplicate: ${gameId}`);
        await deleteDoc(doc(db, 'games', gameId));
        deletedCount++;
        
        deletionResults.push({
          gameId,
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
      message: `Force deleted ${deletedCount} duplicate games from Week 4`,
      deletedCount,
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
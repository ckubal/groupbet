import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

export async function GET() {
  try {
    // Check all games
    const gamesQuery = query(collection(db, 'games'));
    
    const gamesSnapshot = await getDocs(gamesQuery);
    const allGames = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    // Filter for Week 4 games
    const games = allGames.filter(game => game.week === 4);

    // Find Seahawks @ Cardinals game
    const seahawksGame = games.find(game => 
      game.teams?.includes('Seahawks') && game.teams?.includes('Cardinals')
    );

    // Check bets for this game
    let bets = [];
    if (seahawksGame) {
      const betsQuery = query(
        collection(db, 'bets'),
        where('gameId', '==', seahawksGame.id)
      );
      const betsSnapshot = await getDocs(betsQuery);
      bets = betsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Check game mappings
    const mappingsQuery = query(collection(db, 'game_mappings'));
    const mappingsSnapshot = await getDocs(mappingsQuery);
    const mappings = mappingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const seahawksMapping = mappings.find(m => 
      m.teams?.includes('Seahawks') && m.teams?.includes('Cardinals')
    );

    return NextResponse.json({
      success: true,
      week4GamesCount: games.length,
      seahawksGame,
      betsForGame: bets.length,
      betDetails: bets,
      seahawksMapping,
      allGames: games.map(g => ({
        id: g.id,
        teams: g.teams,
        status: g.status
      }))
    });
  } catch (error) {
    console.error('Error debugging Seahawks game:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
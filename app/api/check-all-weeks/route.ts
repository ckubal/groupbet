import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

export async function GET() {
  try {
    // Get all games
    const gamesSnapshot = await getDocs(collection(db, 'games'));
    const games = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    // Group by week
    const gamesByWeek: Record<number, any[]> = {};
    games.forEach(game => {
      const week = game.week || 0;
      if (!gamesByWeek[week]) {
        gamesByWeek[week] = [];
      }
      gamesByWeek[week].push({
        id: game.id,
        teams: game.teams,
        status: game.status,
        gameTime: game.gameTime
      });
    });

    // Find Seahawks @ Cardinals game
    const seahawksGame = games.find(game => 
      game.teams?.includes('Seahawks') && game.teams?.includes('Cardinals')
    );

    // Get all bets
    const betsSnapshot = await getDocs(collection(db, 'bets'));
    const bets = betsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    // Find bets related to Seahawks/Cardinals
    const seahawksBets = bets.filter(bet => 
      bet.selection?.includes('Seahawks') || bet.selection?.includes('Cardinals')
    );

    return NextResponse.json({
      totalGames: games.length,
      gamesByWeek: Object.entries(gamesByWeek).map(([week, games]) => ({
        week: parseInt(week),
        count: games.length,
        games
      })),
      seahawksGame,
      seahawksBets: seahawksBets.map(b => ({
        id: b.id,
        selection: b.selection,
        gameId: b.gameId,
        placedBy: b.placedBy
      })),
      currentDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking weeks:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { oddsApi } from '@/lib/odds-api';
import { getCurrentNFLWeek } from '@/lib/utils';
import { betService } from '@/lib/firebase-service';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const currentWeek = week ? parseInt(week) : getCurrentNFLWeek();
    console.log('🔍 DEBUG: Checking games and bets for week', currentWeek);
    
    // Get games for current week
    const games = await oddsApi.getNFLGames(currentWeek, true);
    
    // Get all bets for current and nearby weeks
    const currentWeekId = `2025-week-${currentWeek}`;
    const prevWeekId = `2025-week-${Math.max(1, currentWeek - 1)}`;
    const nextWeekId = `2025-week-${Math.min(18, currentWeek + 1)}`;
    
    // Get all bets directly from Firebase
    const allBetsSnapshot = await getDocs(collection(db, 'bets'));
    const allFirebaseBets: any[] = [];
    allBetsSnapshot.forEach((doc: any) => {
      allFirebaseBets.push({ id: doc.id, ...doc.data() });
    });
    
    const currentWeekBets = await betService.getBetsForWeekend(currentWeekId);
    const prevWeekBets = await betService.getBetsForWeekend(prevWeekId);
    const nextWeekBets = await betService.getBetsForWeekend(nextWeekId);
    const allBets = [...currentWeekBets, ...prevWeekBets, ...nextWeekBets];
    
    // Find Chiefs game
    const chiefsGame = games.find(g => 
      g.homeTeam.toLowerCase().includes('chiefs') || 
      g.awayTeam.toLowerCase().includes('chiefs')
    );
    
    // Find bets with missing games
    const betsWithMissingGames = allBets.filter(bet => !games.find(g => g.id === bet.gameId));
    
    // Find bets on Chiefs
    const chiefsBets = allBets.filter(bet => 
      bet.selection.toLowerCase().includes('chiefs') ||
      bet.selection.toLowerCase().includes('kansas')
    );
    
    return NextResponse.json({
      currentWeek,
      totalGames: games.length,
      totalBets: allBets.length,
      totalFirebaseBets: allFirebaseBets.length,
      prevWeekBets: prevWeekBets.length,
      currentWeekBets: currentWeekBets.length,
      nextWeekBets: nextWeekBets.length,
      firebaseBetSample: allFirebaseBets.slice(0, 3).map(bet => ({
        id: bet.id,
        weekendId: bet.weekendId,
        gameId: bet.gameId,
        selection: bet.selection,
        participants: bet.participants
      })),
      chiefsGame: chiefsGame ? {
        id: chiefsGame.id,
        homeTeam: chiefsGame.homeTeam,
        awayTeam: chiefsGame.awayTeam,
        status: chiefsGame.status
      } : null,
      chiefsBets: chiefsBets.map(bet => ({
        id: bet.id,
        gameId: bet.gameId,
        selection: bet.selection,
        placedBy: bet.placedBy
      })),
      betsWithMissingGames: betsWithMissingGames.map(bet => ({
        id: bet.id,
        gameId: bet.gameId,
        selection: bet.selection,
        weekendId: bet.weekendId
      })),
      allGameIds: games.map(g => ({ id: g.id, teams: `${g.awayTeam} @ ${g.homeTeam}` }))
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
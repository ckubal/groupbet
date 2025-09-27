import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';
import { gamesCacheService } from '@/lib/games-cache';

export async function POST(request: NextRequest) {
  try {
    const { gameId, week } = await request.json();
    
    if (!gameId) {
      return NextResponse.json({ 
        error: 'Missing gameId' 
      }, { status: 400 });
    }
    
    console.log(`🎯 Manually fetching player props for game ${gameId}...`);
    
    // Get the game from Firebase
    const game = await gamesCacheService.findGameByAnyId(gameId);
    
    if (!game) {
      return NextResponse.json({ 
        error: 'Game not found',
        gameId 
      }, { status: 404 });
    }
    
    console.log(`📋 Found game: ${game.awayTeam} @ ${game.homeTeam}, status: ${game.status}`);
    
    // Force fetch player props regardless of status (unless game is final)
    if (game.status === 'final') {
      return NextResponse.json({
        success: false,
        message: 'Cannot fetch player props for completed games',
        gameStatus: game.status
      });
    }
    
    try {
      // Fetch player props directly
      const props = await oddsApi.getPlayerProps(game.id, game.status);
      
      if (props.length > 0) {
        console.log(`✅ Fetched ${props.length} player props`);
        
        // Update the game in Firebase with the new props
        await updateDoc(doc(db, 'games', game.id), {
          playerProps: props,
          playerPropsUpdatedAt: new Date()
        });
        
        return NextResponse.json({
          success: true,
          message: `Fetched ${props.length} player props for ${game.awayTeam} @ ${game.homeTeam}`,
          props,
          game: {
            id: game.id,
            teams: `${game.awayTeam} @ ${game.homeTeam}`,
            status: game.status
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'No player props available from Odds API',
          game: {
            id: game.id,
            teams: `${game.awayTeam} @ ${game.homeTeam}`,
            status: game.status
          }
        });
      }
    } catch (error) {
      console.error('❌ Error fetching player props:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch player props',
        game: {
          id: game.id,
          teams: `${game.awayTeam} @ ${game.homeTeam}`,
          status: game.status
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error in fetch-player-props:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch player props', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';
import { cleanFirebaseData } from '@/lib/firebase-utils';
import { gamesCacheService } from '@/lib/games-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerName, propType, line, overOdds, underOdds, playerId, week } = await request.json();
    
    if (!gameId || !playerName || !propType || line === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: gameId, playerName, propType, line' 
      }, { status: 400 });
    }
    
    // Try to find the game using any ID (ESPN, Odds API, readable)
    console.log(`🔍 Looking for game ${gameId} using enhanced search...`);
    let gameData = await gamesCacheService.findGameByAnyId(gameId);
    
    if (!gameData) {
      // If still not found, try to get it from the API and cache it
      console.log(`🔍 Game ${gameId} not found in cache, fetching from API...`);
      const weekNumber = week || getCurrentNFLWeek();
      
      // Use the cache service to get all games and find our specific game
      const games = await oddsApi.getNFLGames(weekNumber, true);
      const game = games.find(g => g.id === gameId || g.espnId === gameId || g.readableId === gameId);
      
      if (!game) {
        return NextResponse.json({ 
          error: 'Game not found',
          message: `Game ${gameId} not found in Week ${weekNumber} games. Check if the gameId is correct.`,
          availableGameIds: games.slice(0, 3).map(g => ({
            id: g.id,
            espnId: g.espnId,
            teams: `${g.awayTeam} @ ${g.homeTeam}`
          }))
        }, { status: 404 });
      }
      
      // Cache the game using the enhanced system
      await gamesCacheService.getGamesForWeek(weekNumber, true);
      
      // Try to find it again after caching
      gameData = await gamesCacheService.findGameByAnyId(gameId);
      if (!gameData) {
        // Use the game directly if still not found in cache
        gameData = game;
      }
      
      console.log(`💾 Game ${gameId} processed and available`);
    } else {
      console.log(`✅ Found game ${gameId} in Firebase cache`);
    }
    
    // Create the new player prop
    const newPlayerProp = {
      playerId: playerId || `${playerName.toLowerCase().replace(/\s+/g, '-')}-${propType}`,
      playerName,
      propType,
      line,
      overOdds: overOdds || -110,
      underOdds: underOdds || -110
    };
    
    // Add to existing playerProps or create new array
    const existingPlayerProps = gameData.playerProps || [];
    const updatedPlayerProps = [...existingPlayerProps, newPlayerProp];
    
    // Update the game document with the new player props
    const cleanGameData = cleanFirebaseData({
      ...gameData,
      playerProps: updatedPlayerProps
    });
    
    await setDoc(doc(db, 'games', gameId), cleanGameData, { merge: true });
    
    console.log(`✅ Added player prop: ${playerName} ${propType} ${line}`);
    
    return NextResponse.json({
      success: true,
      message: `Added ${playerName} ${propType} ${line} prop to game`,
      playerProp: newPlayerProp,
      totalPlayerProps: updatedPlayerProps.length
    });
    
  } catch (error) {
    console.error('❌ Error adding player prop:', error);
    return NextResponse.json({ 
      error: 'Failed to add player prop', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
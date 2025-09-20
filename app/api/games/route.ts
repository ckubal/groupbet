import { NextRequest, NextResponse } from 'next/server';
import { oddsApi } from '@/lib/odds-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const force = searchParams.get('force') === 'true';
    
    // Default to week 2 if no week specified (backward compatibility)
    const weekNumber = week ? parseInt(week) : 2;
    
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }
    
    console.log(`🌐 API ROUTE: Fetching NFL games for Week ${weekNumber} (force: ${force})`);
    
    // Get games with optional force refresh
    const games = await oddsApi.getNFLGames(weekNumber, force);
    
    console.log(`✅ API ROUTE: Successfully fetched ${games.length} games for Week ${weekNumber}`);
    
    // Return games directly (not wrapped in object) for simpler client consumption
    return NextResponse.json(games);
    
  } catch (error) {
    console.error('❌ API ROUTE ERROR:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch games', 
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }, { status: 500 });
  }
}
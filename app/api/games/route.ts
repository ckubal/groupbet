import { NextRequest, NextResponse } from 'next/server';
import { oddsApi } from '@/lib/odds-api';
import { enhanceGamesWithBetOdds, getGameIdsFromBets } from '@/lib/bet-odds-extractor';
import { betService } from '@/lib/firebase-service';
import { gamesCacheService } from '@/lib/games-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const force = searchParams.get('force') === 'true';
    
    // Default to current NFL week if no week specified
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }
    
    console.log(`🌐 API ROUTE: Fetching NFL games for Week ${weekNumber} (force: ${force})`);
    
    // Get games using Firebase-first caching system
    const games = await gamesCacheService.getGamesForWeek(weekNumber, force);
    
    console.log(`✅ API ROUTE: Successfully fetched ${games.length} games for Week ${weekNumber}`);
    
    // Skip auto-resolve from games API to prevent circular dependency
    // Auto-resolve is handled separately by the client or scheduled jobs
    console.log(`ℹ️ Skipping auto-resolve from games API to prevent circular dependency`);
    
    // For completed games, enhance with betting lines from user bets
    const completedGames = games.filter(g => g.status === 'final');
    if (completedGames.length > 0) {
      console.log(`📊 Enhancing ${completedGames.length} completed games with betting lines from user bets...`);
      
      try {
        // Get all bets for this week from all users
        const weekendId = `2025-week-${weekNumber}`;
        const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
        const allBets: any[] = [];
        
        for (const userId of allUserIds) {
          try {
            const userBets = await betService.getBetsForUser(userId, weekendId);
            allBets.push(...userBets);
          } catch (error) {
            // User may not have bets, continue
          }
        }
        
        // Deduplicate bets by ID
        const uniqueBets = allBets.reduce((acc: any[], current: any) => {
          if (!acc.find(bet => bet.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        console.log(`📊 Found ${uniqueBets.length} unique bets to extract betting lines from`);
        
        // Enhance games with betting lines from user bets
        const enhancedGames = enhanceGamesWithBetOdds(games, uniqueBets);
        
        // Return enhanced games directly (not wrapped in object) for simpler client consumption
        return NextResponse.json(enhancedGames);
      } catch (error) {
        console.warn('⚠️ Could not enhance games with bet odds:', error);
        // Fall back to original games if enhancement fails
      }
    }
    
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
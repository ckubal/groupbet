import { NextRequest, NextResponse } from 'next/server';
import { bettingLinesScheduler } from '@/lib/betting-lines-scheduler';
import { getCurrentNFLWeek } from '@/lib/utils';

/**
 * Run betting lines scheduler
 * POST /api/betting-lines/scheduler
 * 
 * Body options:
 * - { type: 'automatic' } - Run automatic scheduled update
 * - { type: 'emergency', week?: number } - Run emergency fetch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, week } = body;
    
    console.log('🤖 BettingLines Scheduler API:', { type, week });
    
    if (type === 'emergency') {
      // Run emergency fetch
      const weekNumber = week || getCurrentNFLWeek();
      console.log(`🚨 Running emergency betting lines fetch for Week ${weekNumber}...`);
      
      const result = await bettingLinesScheduler.runEmergencyFetch(weekNumber);
      
      return NextResponse.json({
        success: result.success,
        type: 'emergency',
        result
      });
      
    } else {
      // Run automatic scheduled update
      console.log('🤖 Running automatic betting lines update...');
      
      const result = await bettingLinesScheduler.runAutomaticBettingLinesUpdate();
      
      return NextResponse.json({
        success: result.success,
        type: 'automatic',
        result
      });
    }
    
  } catch (error) {
    console.error('❌ Error in betting lines scheduler API:', error);
    return NextResponse.json({ 
      error: 'Failed to run betting lines scheduler',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get scheduler status
 * GET /api/betting-lines/scheduler
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting betting lines scheduler status...');
    
    const status = bettingLinesScheduler.getSchedulerStatus();
    const schedules = bettingLinesScheduler.getOptimalSchedule();
    
    return NextResponse.json({
      success: true,
      status,
      schedules,
      info: {
        description: 'Automatic betting lines caching system',
        features: [
          'Strategic timing to minimize API calls',
          'Automatic pre-game line freezing',
          'Emergency fetch capabilities',
          'Multi-week support'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting scheduler status:', error);
    return NextResponse.json({ 
      error: 'Failed to get scheduler status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
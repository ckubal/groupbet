import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/firebase-service';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week');
    const week = weekParam ? parseInt(weekParam) : getCurrentNFLWeek();
    
    if (isNaN(week) || week < 1 || week > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }
    
    console.log(`📊 Getting prediction records for Week ${week}...`);
    
    const records = await predictionService.getPredictionRecords(week);
    
    return NextResponse.json({
      week,
      success: true,
      records,
    });
  } catch (error) {
    console.error('❌ Error getting prediction records:', error);
    return NextResponse.json({
      error: 'Failed to get prediction records',
      details: error instanceof Error ? error.message : String(error),
      success: false
    }, { status: 500 });
  }
}

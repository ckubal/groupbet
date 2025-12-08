import { NextRequest, NextResponse } from 'next/server';
import { espnApi } from '@/lib/espn-api';

export async function GET(request: NextRequest) {
  try {
    const week = 14;
    console.log(`🧪 TEST: Fetching ESPN data for Week ${week}...`);
    
    const espnData = await espnApi.getScoreboard(week);
    
    if (!espnData) {
      return NextResponse.json({
        success: false,
        error: 'ESPN API returned null',
        week
      });
    }
    
    return NextResponse.json({
      success: true,
      week,
      season: espnData.season,
      espnWeek: espnData.week,
      eventsCount: espnData.events?.length || 0,
      events: espnData.events?.map(event => ({
        id: event.id,
        name: event.name,
        date: event.date,
        status: event.status?.type?.description,
        competitors: event.competitions?.[0]?.competitors?.map((c: any) => ({
          team: c.team?.displayName,
          homeAway: c.homeAway,
          score: c.score
        }))
      })) || []
    });
  } catch (error) {
    console.error('❌ TEST ERROR:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      week: 14
    }, { status: 500 });
  }
}

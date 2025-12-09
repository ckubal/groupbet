import { NextRequest, NextResponse } from 'next/server';
import { betService } from '@/lib/firebase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const weekendId = searchParams.get('weekendId');
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId parameter is required' 
      }, { status: 400 });
    }
    
    console.log(`📊 API: Fetching bets for user ${userId}${weekendId ? ` for ${weekendId}` : ''}`);
    
    // Use server-side betService which has proper Firebase admin access
    const bets = await betService.getBetsForUser(userId, weekendId || undefined);
    
    console.log(`✅ API: Found ${bets.length} bets for user ${userId}`);
    
    return NextResponse.json({
      success: true,
      bets: bets.map(bet => ({
        ...bet,
        createdAt: bet.createdAt instanceof Date ? bet.createdAt.toISOString() : bet.createdAt,
        resolvedAt: bet.resolvedAt instanceof Date ? bet.resolvedAt.toISOString() : bet.resolvedAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching user bets:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Bet } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

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
    
    console.log(`📊 API: Fetching bets for user ${userId}${weekendId ? ` for ${weekendId}` : ''} using Admin SDK`);
    
    // Use Firebase Admin SDK to bypass security rules
    const adminDb = await getAdminDb();
    let query = adminDb.collection('bets').where('participants', 'array-contains', userId);
    
    if (weekendId) {
      query = query.where('weekendId', '==', weekendId);
    }
    
    const snapshot = await query.get();
    const bets: Bet[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      bets.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date()),
        resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : (data.resolvedAt instanceof Date ? data.resolvedAt : undefined)
      } as Bet);
    });
    
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

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

interface ResearchBet {
  weekendId: string;
  userId: string;
  gameKey: string;
  bet: 'over' | 'under';
  line: number;
  placedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekendId = searchParams.get('weekendId');
    const userId = searchParams.get('userId');

    if (!weekendId || !userId) {
      return NextResponse.json({ error: 'Missing weekendId or userId' }, { status: 400 });
    }

    // Use Admin SDK for server-side access
    const adminDb = await getAdminDb();
    const snapshot = await adminDb.collection('researchBets')
      .where('weekendId', '==', weekendId)
      .where('userId', '==', userId)
      .get();

    const bets: ResearchBet[] = [];
    snapshot.forEach((doc: any) => {
      bets.push(doc.data() as ResearchBet);
    });

    return NextResponse.json({ bets });
  } catch (error) {
    console.error('Error fetching research bets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch research bets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekendId, userId, gameKey, bet, line } = body;

    if (!weekendId || !userId || !gameKey || !bet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const betId = `${weekendId}-${userId}-${gameKey}-${bet}`;
    const researchBet: ResearchBet = {
      weekendId,
      userId,
      gameKey,
      bet,
      line: line || 0,
      placedAt: new Date().toISOString(),
    };

    // Use Admin SDK for server-side access
    const adminDb = await getAdminDb();
    await adminDb.collection('researchBets').doc(betId).set(researchBet);

    return NextResponse.json({ success: true, bet: researchBet });
  } catch (error) {
    console.error('Error saving research bet:', error);
    return NextResponse.json(
      { error: 'Failed to save research bet' },
      { status: 500 }
    );
  }
}

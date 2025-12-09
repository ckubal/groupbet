import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Test endpoint to verify Firebase Admin SDK is working
 * GET /api/test-admin-sdk
 */
export async function GET() {
  try {
    console.log('🧪 Testing Firebase Admin SDK...');
    
    // Try to get Admin DB
    const adminDb = await getAdminDb();
    
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Admin DB is null - falling back to client SDK',
        message: 'Firebase Admin SDK is not properly configured. Check environment variables.'
      }, { status: 500 });
    }
    
    // Check if it's Admin SDK (has .collection method)
    const isAdminSDK = adminDb && typeof adminDb.collection === 'function';
    
    if (!isAdminSDK) {
      return NextResponse.json({
        success: false,
        error: 'Not using Admin SDK - using client SDK instead',
        message: 'Firebase Admin SDK is not properly configured. Check environment variables.'
      }, { status: 500 });
    }
    
    // Try a simple read operation
    try {
      const testQuery = adminDb.collection('games').limit(1);
      const snapshot = await testQuery.get();
      
      return NextResponse.json({
        success: true,
        message: '✅ Firebase Admin SDK is working correctly!',
        details: {
          isAdminSDK: true,
          canRead: true,
          sampleGamesFound: snapshot.size,
          environment: {
            hasProjectId: !!process.env.FIREBASE_PROJECT_ID || !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          }
        }
      });
    } catch (readError: any) {
      return NextResponse.json({
        success: false,
        error: 'Admin SDK initialized but cannot read',
        message: readError.message,
        details: {
          isAdminSDK: true,
          canRead: false,
          errorCode: readError.code,
        }
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin SDK test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      message: 'Firebase Admin SDK failed to initialize',
      details: {
        environment: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID || !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        },
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
}

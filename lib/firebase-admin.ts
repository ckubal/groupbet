/**
 * Firebase Admin SDK for server-side operations
 * This bypasses security rules and should only be used in API routes
 */

let admin: any;
let adminDb: any;

// Lazy load Firebase Admin SDK to avoid issues if not configured
async function getAdmin() {
  if (!admin) {
    try {
      admin = await import('firebase-admin');
      const adminModule = admin.default || admin;
      
      // Initialize Firebase Admin SDK if not already initialized
      if (!adminModule.apps.length) {
        // Try to use service account credentials from environment variables
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
        const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)?.trim();
        
        // Log what we have (without exposing sensitive values)
        console.log('🔍 Admin SDK Init Check:', {
          hasPrivateKey: !!privateKeyRaw,
          privateKeyLength: privateKeyRaw?.length || 0,
          hasClientEmail: !!clientEmail,
          clientEmailLength: clientEmail?.length || 0,
          hasProjectId: !!projectId,
          projectId: projectId || 'NOT SET',
        });
        
        if (privateKey && clientEmail) {
          // Use service account credentials
          if (!projectId) {
            throw new Error('FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set');
          }
          
          try {
            adminModule.initializeApp({
              credential: adminModule.credential.cert({
                projectId,
                clientEmail: clientEmail.trim(),
                privateKey,
              }),
            });
            console.log('✅ Firebase Admin SDK initialized with service account');
          } catch (initError) {
            console.error('❌ Failed to initialize Admin SDK with service account:', initError);
            throw initError;
          }
        } else {
          // Fallback: Use application default credentials (for local development or if service account not configured)
          // This will work if FIREBASE_PROJECT_ID is set and we're using default credentials
          const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)?.trim();
          
          if (!projectId) {
            console.warn('⚠️ No Firebase project ID found - Admin SDK may not work');
            throw new Error('FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set');
          }
          
          adminModule.initializeApp({
            projectId,
          });
          console.log('✅ Firebase Admin SDK initialized with default credentials');
        }
      }
      
      adminDb = adminModule.firestore();
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error);
      console.warn('⚠️ Falling back to client SDK - this may cause permission errors');
      // Fallback to client SDK if Admin SDK not available
      const { db } = await import('./firebase');
      adminDb = db;
    }
  }
  return { admin: admin?.default || admin, adminDb };
}

export async function getAdminDb() {
  const { adminDb: db } = await getAdmin();
  return db;
}

export default getAdmin;

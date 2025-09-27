const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, deleteDoc } = require('firebase/firestore');

// Firebase config 
const firebaseConfig = {
  apiKey: "AIzaSyDgX_4Q2Q4Rc9VQZr6gHGlFllQpYrJJaU4",
  authDomain: "groupbet-7dfcd.firebaseapp.com",
  databaseURL: "https://groupbet-7dfcd-default-rtdb.firebaseio.com",
  projectId: "groupbet-7dfcd",
  storageBucket: "groupbet-7dfcd.firebasestorage.app",
  messagingSenderId: "462733032938",
  appId: "1:462733032938:web:8c8a1b5bb7825c56e66ad4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearWeek3Cache() {
  try {
    console.log('🧹 Clearing Week 3 game cache from Firebase...\n');
    
    // Query for Week 3 games
    const gamesQuery = query(
      collection(db, 'games'), 
      where('weekendId', '==', '2025-week-3')
    );
    
    const snapshot = await getDocs(gamesQuery);
    
    if (snapshot.empty) {
      console.log('✅ No cached games found for 2025-week-3');
      return;
    }
    
    console.log(`🗑️ Found ${snapshot.size} cached games to delete...\n`);
    
    // Delete all cached Week 3 games
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log('✅ Successfully cleared Week 3 game cache');
    console.log('💡 Next API call will fetch fresh data with correct time slots');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearWeek3Cache();
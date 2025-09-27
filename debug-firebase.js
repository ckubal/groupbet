const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Firebase config (from your env)
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

async function checkFirebaseData() {
  try {
    console.log('🔍 Checking Firebase games data for Week 3...\n');
    
    // Query for Week 3 games
    const gamesQuery = query(
      collection(db, 'games'), 
      where('weekendId', '==', '2025-week-3')
    );
    
    const snapshot = await getDocs(gamesQuery);
    
    if (snapshot.empty) {
      console.log('❌ No games found for 2025-week-3');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} games in Firebase for 2025-week-3\n`);
    
    // Group by time slot
    const timeSlotGroups = {};
    
    snapshot.docs.forEach(doc => {
      const game = doc.data();
      const timeSlot = game.timeSlot || 'unknown';
      
      if (!timeSlotGroups[timeSlot]) {
        timeSlotGroups[timeSlot] = [];
      }
      
      timeSlotGroups[timeSlot].push({
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        gameTime: game.gameTime.toDate(),
        status: game.status
      });
    });
    
    // Display results
    Object.keys(timeSlotGroups).forEach(slot => {
      console.log(`🕐 ${slot.toUpperCase().replace('_', ' ')} (${timeSlotGroups[slot].length} games):`);
      timeSlotGroups[slot].forEach(game => {
        console.log(`   ${game.matchup} - ${game.gameTime} (${game.status})`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking Firebase:', error);
  }
}

checkFirebaseData();
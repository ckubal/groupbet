import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculatePayout } from '@/lib/betting-odds';

interface UserBalance {
  won: number;
  lost: number;
  net: number;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export async function GET(request: NextRequest) {
  console.log('💰 Calculating weekly settlement...');
  
  try {
    const { searchParams } = new URL(request.url);
    const weekendId = searchParams.get('weekendId') || '2025-week-2';
    
    // Get all bets for the week
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', weekendId)
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`📊 Found ${betsSnapshot.docs.length} bets for settlement`);
    
    const allBets = betsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Calculate each user's balance based on bet maker responsibility
    const userBalances: Record<string, UserBalance> = {};
    const users = ['will', 'dio', 'rosen', 'charlie'];
    
    // Initialize user balances
    users.forEach(user => {
      userBalances[user] = { won: 0, lost: 0, net: 0 };
    });
    
    // Process each bet with different logic for head-to-head vs group bets
    allBets.forEach((bet: any) => {
      // Skip cancelled bets
      if (bet.status === 'cancelled') return;
      
      const { profit } = calculatePayout(bet.amountPerPerson, bet.odds);
      const betMaker = bet.placedBy;
      
      if (bet.bettingMode === 'head_to_head') {
        // Head-to-head: direct player vs player transfer
        // Only one person wins, the other loses the same amount
        if (bet.status === 'won') {
          // In head-to-head, bet.participants should be [winner, loser] based on bet.placedBy
          // The person who placed the bet (bet.placedBy) is the winner
          const winner = bet.placedBy;
          const loser = bet.participants.find((p: string) => p !== winner);
          
          if (winner && loser && userBalances[winner] && userBalances[loser]) {
            // Winner receives the bet amount from loser
            userBalances[winner].net += bet.amountPerPerson;
            userBalances[winner].won += bet.amountPerPerson;
            
            // Loser pays the bet amount to winner
            userBalances[loser].net -= bet.amountPerPerson;
            userBalances[loser].lost += bet.amountPerPerson;
          }
        } else if (bet.status === 'lost') {
          // In head-to-head, bet.participants should be [loser, winner] based on bet.placedBy
          // The person who placed the bet (bet.placedBy) is the loser
          const loser = bet.placedBy;
          const winner = bet.participants.find((p: string) => p !== loser);
          
          if (winner && loser && userBalances[winner] && userBalances[loser]) {
            // Winner receives the bet amount from loser
            userBalances[winner].net += bet.amountPerPerson;
            userBalances[winner].won += bet.amountPerPerson;
            
            // Loser pays the bet amount to winner
            userBalances[loser].net -= bet.amountPerPerson;
            userBalances[loser].lost += bet.amountPerPerson;
          }
        }
      } else {
        // Group bet: bet maker responsibility model
        if (bet.status === 'won') {
          // Bet maker owes profits to all participants (including themselves)
          const totalProfit = profit * bet.participants.length;
          
          if (userBalances[betMaker]) {
            userBalances[betMaker].net -= totalProfit; // Bet maker owes money
            userBalances[betMaker].lost += totalProfit;
          }
          
          // All participants get their share of profit
          bet.participants.forEach((participant: string) => {
            if (userBalances[participant]) {
              userBalances[participant].net += profit; // Participant receives profit
              userBalances[participant].won += profit;
            }
          });
          
        } else if (bet.status === 'lost') {
          // All participants owe their losses to the bet maker
          bet.participants.forEach((participant: string) => {
            if (userBalances[participant]) {
              userBalances[participant].net -= bet.amountPerPerson; // Participant owes stake
              userBalances[participant].lost += bet.amountPerPerson;
            }
          });
          
          // Bet maker receives all the lost stakes
          const totalLost = bet.amountPerPerson * bet.participants.length;
          if (userBalances[betMaker]) {
            userBalances[betMaker].net += totalLost; // Bet maker receives stakes
            userBalances[betMaker].won += totalLost;
          }
        }
      }
    });
    
    console.log('💰 User balances:', userBalances);
    
    // Optimize head-to-head transfers before calculating settlements
    // Look for head-to-head bets and apply direct transfers
    const headToHeadTransfers: Record<string, number> = {};
    
    allBets.forEach((bet: any) => {
      if (bet.bettingMode === 'head_to_head' && bet.status !== 'cancelled') {
        const bettor = bet.placedBy;
        
        // Find the opposing head-to-head bet
        const opposingBet = allBets.find((otherBet: any) => 
          otherBet.bettingMode === 'head_to_head' && 
          otherBet.id !== bet.id &&
          otherBet.status !== 'cancelled' &&
          // Look for bets with matching selection but opposite outcomes
          ((bet.status === 'won' && otherBet.status === 'lost') ||
           (bet.status === 'lost' && otherBet.status === 'won')) &&
          // Same game/matchup (check if selections mention each other)
          (bet.selection.includes(otherBet.placedBy) || otherBet.selection.includes(bet.placedBy))
        );
        
        if (opposingBet && bet.status === 'won') {
          const winner = bet.placedBy;
          const loser = opposingBet.placedBy;
          const transferAmount = bet.amountPerPerson;
          
          // Apply direct transfer
          const transferKey = `${loser}->${winner}`;
          headToHeadTransfers[transferKey] = (headToHeadTransfers[transferKey] || 0) + transferAmount;
          
          console.log(`💰 Head-to-head transfer: ${loser} owes ${winner} $${transferAmount}`);
        }
      }
    });
    
    // Apply head-to-head transfers to user balances
    Object.entries(headToHeadTransfers).forEach(([transfer, amount]) => {
      const [loser, winner] = transfer.split('->');
      if (userBalances[loser] && userBalances[winner]) {
        userBalances[loser].net -= amount;
        userBalances[winner].net += amount;
        console.log(`🔄 Applied H2H transfer: ${loser} -$${amount}, ${winner} +$${amount}`);
      }
    });
    
    // Calculate settlements (who owes whom)
    const settlements: Settlement[] = [];
    const creditors = users.filter(user => userBalances[user].net > 0)
      .sort((a, b) => userBalances[b].net - userBalances[a].net);
    const debtors = users.filter(user => userBalances[user].net < 0)
      .sort((a, b) => userBalances[a].net - userBalances[b].net);
    
    // Simple settlement algorithm
    let creditorIndex = 0;
    let debtorIndex = 0;
    
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      
      const creditorBalance = userBalances[creditor].net;
      const debtorBalance = Math.abs(userBalances[debtor].net);
      
      const settlementAmount = Math.min(creditorBalance, debtorBalance);
      
      if (settlementAmount > 0.01) { // Only settle amounts over 1 cent
        const roundedAmount = Math.round(settlementAmount * 100) / 100;
        settlements.push({
          from: debtor,
          to: creditor,
          amount: roundedAmount
        });
        
        userBalances[creditor].net = Math.round((userBalances[creditor].net - roundedAmount) * 100) / 100;
        userBalances[debtor].net = Math.round((userBalances[debtor].net + roundedAmount) * 100) / 100;
      }
      
      if (Math.abs(userBalances[creditor].net) < 0.01) creditorIndex++;
      if (Math.abs(userBalances[debtor].net) < 0.01) debtorIndex++;
    }
    
    // Calculate totals
    const totalWon = Object.values(userBalances).reduce((sum, balance) => sum + balance.won, 0);
    const totalLost = Object.values(userBalances).reduce((sum, balance) => sum + balance.lost, 0);
    const totalNet = Object.values(userBalances).reduce((sum, balance) => sum + balance.net, 0);
    
    console.log(`✅ Settlement calculated: ${settlements.length} transactions needed`);
    
    return NextResponse.json({
      success: true,
      weekendId,
      userBalances,
      settlements,
      summary: {
        totalWon: Math.round(totalWon * 100) / 100,
        totalLost: Math.round(totalLost * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalBets: allBets.length,
        resolvedBets: allBets.filter(bet => bet.status !== 'active').length
      }
    });
    
  } catch (error) {
    console.error('❌ Settlement calculation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
import { useState, useEffect } from 'react';
import { ActualBet } from './ActualBetsTracker';
import { Calculator, DollarSign, Users, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface WeekendSettlementProps {
  actualBets: ActualBet[];
  users: { id: string; name: string }[];
  onSettlement: (settlementData: WeeklySettlement) => void;
}

export interface WeeklySettlement {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  userBalances: { [userId: string]: number };
  transactions: {
    from: string;
    to: string;
    amount: number;
    description: string;
  }[];
  totalAction: number;
  isSettled: boolean;
  settledAt?: Date;
}

interface UserBalance {
  userId: string;
  name: string;
  weeklyProfit: number;
  owes: { to: string; amount: number; name: string }[];
  receives: { from: string; amount: number; name: string }[];
  netPosition: number;
}

export default function WeekendSettlement({ actualBets, users, onSettlement }: WeekendSettlementProps) {
  const [settlementReady, setSettlementReady] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);

  // Check if weekend is complete (all games finished)
  useEffect(() => {
    const checkWeekendComplete = () => {
      const weekendBets = getWeekendBets();
      const allSettled = weekendBets.every(bet => 
        bet.status === 'won' || bet.status === 'lost' || bet.status === 'push'
      );
      
      const hasActiveBets = weekendBets.some(bet => 
        bet.status === 'live' || bet.status === 'pending'
      );

      setSettlementReady(allSettled && weekendBets.length > 0 && !hasActiveBets);
    };

    checkWeekendComplete();
  }, [actualBets]);

  const getWeekendBets = () => {
    // Get bets from this weekend (Friday through Monday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 5); // Friday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Monday
    endOfWeek.setHours(23, 59, 59, 999);

    return actualBets.filter(bet => 
      bet.createdAt >= startOfWeek && bet.createdAt <= endOfWeek
    );
  };

  const calculateUserBalances = (): UserBalance[] => {
    const weekendBets = getWeekendBets();
    const userBalances: { [userId: string]: UserBalance } = {};

    // Initialize user balances
    users.forEach(user => {
      userBalances[user.id] = {
        userId: user.id,
        name: user.name,
        weeklyProfit: 0,
        owes: [],
        receives: [],
        netPosition: 0
      };
    });

    // Calculate profits/losses for each user
    weekendBets.forEach(bet => {
      bet.participants.forEach(userId => {
        if (!userBalances[userId]) return;

        if (bet.type === 'head_to_head' && bet.h2h) {
          // H2H bet settlement
          const userSide = bet.h2h.sideA.participants.includes(userId) ? 'A' : 'B';
          
          if (bet.status === 'won') {
            // User was on winning side
            if ((userSide === 'A' && bet.h2h.sideA.participants.includes(userId)) ||
                (userSide === 'B' && bet.h2h.sideB.participants.includes(userId))) {
              const totalPool = bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length);
              const winningSide = userSide === 'A' ? bet.h2h.sideA : bet.h2h.sideB;
              const winnerShare = totalPool / winningSide.participants.length;
              userBalances[userId].weeklyProfit += winnerShare - bet.h2h.amount; // Profit = winnings minus stake
            }
          } else if (bet.status === 'lost') {
            // User was on losing side
            userBalances[userId].weeklyProfit -= bet.h2h.amount;
          }
          // Push = no change
        } else {
          // Standard bet settlement
          const userShare = bet.betDetails.stake / bet.participants.length;
          
          if (bet.status === 'won') {
            const potentialWin = bet.betDetails.odds > 0 
              ? (userShare * bet.betDetails.odds) / 100
              : (userShare * 100) / Math.abs(bet.betDetails.odds);
            userBalances[userId].weeklyProfit += potentialWin; // Just profit, not including returned stake
          } else if (bet.status === 'lost') {
            userBalances[userId].weeklyProfit -= userShare;
          }
          // Push = no change
        }
      });
    });

    // Calculate net positions and who owes whom
    const balanceArray = Object.values(userBalances);
    const winners = balanceArray.filter(user => user.weeklyProfit > 0);
    const losers = balanceArray.filter(user => user.weeklyProfit < 0);

    // Simple settlement algorithm - losers pay winners proportionally
    losers.forEach(loser => {
      const amountOwed = Math.abs(loser.weeklyProfit);
      const totalWinnings = winners.reduce((sum, winner) => sum + winner.weeklyProfit, 0);
      
      winners.forEach(winner => {
        if (totalWinnings > 0) {
          const proportionalAmount = (winner.weeklyProfit / totalWinnings) * amountOwed;
          if (proportionalAmount > 0.01) { // Only include amounts over 1 cent
            loser.owes.push({
              to: winner.userId,
              amount: proportionalAmount,
              name: winner.name
            });
            winner.receives.push({
              from: loser.userId,
              amount: proportionalAmount,
              name: loser.name
            });
          }
        }
      });
      
      loser.netPosition = -amountOwed;
    });

    winners.forEach(winner => {
      winner.netPosition = winner.weeklyProfit;
    });

    return balanceArray.sort((a, b) => b.weeklyProfit - a.weeklyProfit);
  };

  const executeSettlement = () => {
    const userBalances = calculateUserBalances();
    const weekendBets = getWeekendBets();
    
    const transactions: WeeklySettlement['transactions'] = [];
    
    // Generate transactions from the balance calculations
    userBalances.forEach(user => {
      user.owes.forEach(debt => {
        transactions.push({
          from: user.userId,
          to: debt.to,
          amount: debt.amount,
          description: `Weekend settlement payment`
        });
      });
    });

    const settlement: WeeklySettlement = {
      id: `settlement-${Date.now()}`,
      weekStart: new Date(),
      weekEnd: new Date(),
      userBalances: userBalances.reduce((acc, user) => {
        acc[user.userId] = user.weeklyProfit;
        return acc;
      }, {} as { [userId: string]: number }),
      transactions,
      totalAction: weekendBets.reduce((sum, bet) => {
        if (bet.type === 'head_to_head' && bet.h2h) {
          return sum + (bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length));
        }
        return sum + bet.betDetails.stake;
      }, 0),
      isSettled: true,
      settledAt: new Date()
    };

    onSettlement(settlement);
    setShowSettlement(false);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const userBalances = calculateUserBalances();
  const weekendBets = getWeekendBets();
  const totalAction = weekendBets.reduce((sum, bet) => {
    if (bet.type === 'head_to_head' && bet.h2h) {
      return sum + (bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length));
    }
    return sum + bet.betDetails.stake;
  }, 0);

  if (!settlementReady && weekendBets.length === 0) {
    return null; // No bets to settle
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="text-green-600" size={20} />
            Weekend Settlement
          </h3>
          <p className="text-sm text-gray-600">
            {settlementReady ? 'Ready to settle!' : `${weekendBets.filter(bet => bet.status === 'live' || bet.status === 'pending').length} bets still active`}
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalAction)}</div>
          <div className="text-sm text-gray-600">Total Weekend Action</div>
        </div>
      </div>

      {settlementReady ? (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800 mb-2">
              <CheckCircle size={16} />
              <span className="font-medium">All games complete - Ready to settle!</span>
            </div>
            <p className="text-sm text-green-700">
              {weekendBets.length} bets completed across {users.length} participants
            </p>
          </div>

          <button
            onClick={() => setShowSettlement(true)}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-6"
          >
            <Calculator size={16} />
            Calculate Settlement
          </button>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <Clock size={16} />
            <span className="font-medium">Waiting for games to complete...</span>
          </div>
          <p className="text-sm text-yellow-700">
            {weekendBets.filter(bet => bet.status === 'live' || bet.status === 'pending').length} bets still pending
          </p>
        </div>
      )}

      {/* Current Weekend Preview */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-800">Current Weekend Standings</h4>
        {userBalances.map(user => (
          <div key={user.userId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Users size={16} className="text-gray-500" />
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {user.weeklyProfit > 0 ? (
                <TrendingUp size={16} className="text-green-600" />
              ) : user.weeklyProfit < 0 ? (
                <TrendingDown size={16} className="text-red-600" />
              ) : null}
              <span className={`font-semibold ${
                user.weeklyProfit > 0 ? 'text-green-600' : 
                user.weeklyProfit < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {formatCurrency(user.weeklyProfit)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Settlement Modal */}
      {showSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Weekend Settlement Summary</h3>
            
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalAction)}</div>
                  <div className="text-sm text-gray-600">Total Weekend Action</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">Winners</h4>
                  {userBalances.filter(user => user.weeklyProfit > 0).map(user => (
                    <div key={user.userId} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span>{user.name}</span>
                      <span className="font-semibold text-green-600">+{formatCurrency(user.weeklyProfit)}</span>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Needs to Pay</h4>
                  {userBalances.filter(user => user.weeklyProfit < 0).map(user => (
                    <div key={user.userId} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span>{user.name}</span>
                      <span className="font-semibold text-red-600">{formatCurrency(user.weeklyProfit)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Settlement Transactions</h4>
                <div className="space-y-2">
                  {userBalances.flatMap(user => 
                    user.owes.map((debt, index) => (
                      <div key={`${user.userId}-${debt.to}-${index}`} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                        <span>{user.name} pays {debt.name}</span>
                        <span className="font-semibold">{formatCurrency(debt.amount)}</span>
                      </div>
                    ))
                  )}
                  {userBalances.every(user => user.owes.length === 0) && (
                    <div className="text-center text-gray-500 py-4">No payments needed - everyone broke even!</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSettlement(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeSettlement}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { ActualBet } from './ActualBetsTracker';
import { TrendingUp, TrendingDown, Minus, DollarSign, Trophy, Calendar, Target } from 'lucide-react';

interface BettingPerformanceTrackerProps {
  actualBets: ActualBet[];
  users: { id: string; name: string }[];
}

interface UserPerformance {
  userId: string;
  name: string;
  totalBets: number;
  activeBets: number;
  wonBets: number;
  lostBets: number;
  pushBets: number;
  totalWagered: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  winRate: number;
  recentBets: ActualBet[];
}

export default function BettingPerformanceTracker({ actualBets, users }: BettingPerformanceTrackerProps) {
  const calculateUserPerformance = (): UserPerformance[] => {
    return users.map(user => {
      // Get all bets where user is a participant
      const userBets = actualBets.filter(bet => bet.participants.includes(user.id));
      
      let totalWagered = 0;
      let totalWinnings = 0;
      let totalLosses = 0;
      
      const wonBets = userBets.filter(bet => bet.status === 'won');
      const lostBets = userBets.filter(bet => bet.status === 'lost');
      const pushBets = userBets.filter(bet => bet.status === 'push');
      const activeBets = userBets.filter(bet => bet.status === 'pending' || bet.status === 'live');

      userBets.forEach(bet => {
        if (bet.type === 'head_to_head' && bet.h2h) {
          // H2H bet calculation
          const userSide = bet.h2h.sideA.participants.includes(user.id) ? 'A' : 'B';
          const userSideData = userSide === 'A' ? bet.h2h.sideA : bet.h2h.sideB;
          const opposingSideData = userSide === 'A' ? bet.h2h.sideB : bet.h2h.sideA;
          
          // Each user on a side pays the H2H amount
          totalWagered += bet.h2h.amount;
          
          if (bet.status === 'won') {
            // User wins their share of the total pool
            const totalPool = bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length);
            const winnerShare = totalPool / userSideData.participants.length;
            totalWinnings += winnerShare;
          } else if (bet.status === 'lost') {
            totalLosses += bet.h2h.amount;
          }
          // Push = no money changes hands
        } else {
          // Standard bet calculation
          const userShare = bet.betDetails.stake / bet.participants.length;
          totalWagered += userShare;
          
          if (bet.status === 'won') {
            // Calculate winnings based on odds
            const potentialWin = bet.betDetails.odds > 0 
              ? (userShare * bet.betDetails.odds) / 100
              : (userShare * 100) / Math.abs(bet.betDetails.odds);
            totalWinnings += potentialWin + userShare; // Return stake plus winnings
          } else if (bet.status === 'lost') {
            totalLosses += userShare;
          }
          // Push = stake returned, no profit/loss
        }
      });

      const netProfit = totalWinnings - totalLosses;
      const settledBets = wonBets.length + lostBets.length + pushBets.length;
      const winRate = settledBets > 0 ? (wonBets.length / settledBets) * 100 : 0;

      return {
        userId: user.id,
        name: user.name,
        totalBets: userBets.length,
        activeBets: activeBets.length,
        wonBets: wonBets.length,
        lostBets: lostBets.length,
        pushBets: pushBets.length,
        totalWagered,
        totalWinnings,
        totalLosses,
        netProfit,
        winRate,
        recentBets: userBets
          .filter(bet => bet.status !== 'pending')
          .sort((a, b) => (b.settledAt || b.createdAt).getTime() - (a.settledAt || a.createdAt).getTime())
          .slice(0, 5)
      };
    });
  };

  const getPerformanceIcon = (netProfit: number) => {
    if (netProfit > 0) return <TrendingUp className="text-green-600" size={16} />;
    if (netProfit < 0) return <TrendingDown className="text-red-600" size={16} />;
    return <Minus className="text-gray-600" size={16} />;
  };

  const getPerformanceColor = (netProfit: number): string => {
    if (netProfit > 0) return 'text-green-600';
    if (netProfit < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number): string => {
    return `${percentage.toFixed(1)}%`;
  };

  const userPerformances = calculateUserPerformance().sort((a, b) => b.netProfit - a.netProfit);
  const weeklyBets = actualBets.filter(bet => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return bet.createdAt >= weekAgo;
  });

  return (
    <div className="space-y-6">
      {/* Weekly Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="text-blue-600" size={20} />
          This Week's Activity
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{weeklyBets.length}</div>
            <div className="text-sm text-gray-600">Total Bets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {weeklyBets.filter(bet => bet.status === 'live' || bet.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">Live Bets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {weeklyBets.filter(bet => bet.type === 'head_to_head').length}
            </div>
            <div className="text-sm text-gray-600">H2H Bets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(weeklyBets.reduce((sum, bet) => {
                if (bet.type === 'head_to_head' && bet.h2h) {
                  return sum + (bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length));
                }
                return sum + bet.betDetails.stake;
              }, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Action</div>
          </div>
        </div>
      </div>

      {/* User Performance Leaderboard */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="text-yellow-600" size={20} />
          Performance Leaderboard
        </h3>

        <div className="space-y-4">
          {userPerformances.map((performance, index) => (
            <div key={performance.userId} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${
                    index === 0 ? 'text-yellow-500' : 
                    index === 1 ? 'text-gray-400' : 
                    index === 2 ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{performance.name}</div>
                    <div className="text-sm text-gray-600">
                      {performance.totalBets} total bets • {performance.activeBets} active
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-xl font-bold flex items-center gap-1 ${getPerformanceColor(performance.netProfit)}`}>
                    {getPerformanceIcon(performance.netProfit)}
                    {formatCurrency(performance.netProfit)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatPercentage(performance.winRate)} win rate
                  </div>
                </div>
              </div>

              {/* Performance Details */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{performance.wonBets}</div>
                  <div className="text-gray-600">Won</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{performance.lostBets}</div>
                  <div className="text-gray-600">Lost</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-600">{performance.pushBets}</div>
                  <div className="text-gray-600">Push</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{formatCurrency(performance.totalWagered)}</div>
                  <div className="text-gray-600">Wagered</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">{formatCurrency(performance.totalWinnings)}</div>
                  <div className="text-gray-600">Won</div>
                </div>
              </div>

              {/* Recent Bets */}
              {performance.recentBets.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-sm font-medium text-gray-700 mb-2">Recent Bets</div>
                  <div className="space-y-1">
                    {performance.recentBets.slice(0, 3).map(bet => (
                      <div key={bet.id} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 truncate">
                          {bet.type === 'head_to_head' ? 'H2H: ' : ''}{bet.betDetails.selection}
                        </span>
                        <span className={`font-medium ${
                          bet.status === 'won' ? 'text-green-600' : 
                          bet.status === 'lost' ? 'text-red-600' : 
                          bet.status === 'push' ? 'text-gray-600' :
                          'text-blue-600'
                        }`}>
                          {bet.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="text-purple-600" size={20} />
          Recent Activity
        </h3>

        <div className="space-y-3">
          {weeklyBets
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10)
            .map(bet => (
            <div key={bet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {bet.type === 'head_to_head' ? '⚔️ H2H: ' : '🎯 '}
                  {bet.betDetails.selection}
                </div>
                <div className="text-xs text-gray-600">
                  {bet.game.awayTeam} @ {bet.game.homeTeam} • 
                  {bet.participants.map(id => users.find(u => u.id === id)?.name || id).join(', ')}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium px-2 py-1 rounded ${
                  bet.status === 'won' ? 'bg-green-100 text-green-800' :
                  bet.status === 'lost' ? 'bg-red-100 text-red-800' :
                  bet.status === 'push' ? 'bg-gray-100 text-gray-800' :
                  bet.status === 'live' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {bet.status.toUpperCase()}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {bet.type === 'head_to_head' && bet.h2h 
                    ? formatCurrency(bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length))
                    : formatCurrency(bet.betDetails.stake)
                  }
                </div>
              </div>
            </div>
          ))}
          
          {weeklyBets.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <DollarSign className="mx-auto mb-3 text-gray-400" size={48} />
              <p>No betting activity this week</p>
              <p className="text-sm mt-1">Place some bets to see performance tracking!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
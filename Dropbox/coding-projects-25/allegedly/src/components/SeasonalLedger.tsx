import { useState } from 'react';
import { ActualBet } from './ActualBetsTracker';
import { WeeklySettlement } from './WeekendSettlement';
import { TrendingUp, TrendingDown, BarChart3, Calendar, Trophy, Target, Minus } from 'lucide-react';

interface SeasonalLedgerProps {
  actualBets: ActualBet[];
  settlements: WeeklySettlement[];
  users: { id: string; name: string }[];
}

interface WeeklyPerformance {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  userBalances: { [userId: string]: number };
  userRunningTotals: { [userId: string]: number };
  totalAction: number;
  netChange: { [userId: string]: number };
}

interface SeasonStats {
  userId: string;
  name: string;
  totalBets: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  bestWeek: number;
  worstWeek: number;
  winRate: number;
  totalAction: number;
  weeklyData: { week: number; balance: number; runningTotal: number }[];
}

export default function SeasonalLedger({ actualBets, settlements, users }: SeasonalLedgerProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'season' | '4weeks' | '8weeks'>('season');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const calculateWeeklyPerformance = (): WeeklyPerformance[] => {
    const weeklyData: WeeklyPerformance[] = [];
    const runningTotals: { [userId: string]: number } = {};
    
    // Initialize running totals
    users.forEach(user => {
      runningTotals[user.id] = 0;
    });

    // Group bets by week
    const betsByWeek = new Map<string, ActualBet[]>();
    actualBets.forEach(bet => {
      const weekKey = getWeekKey(bet.createdAt);
      if (!betsByWeek.has(weekKey)) {
        betsByWeek.set(weekKey, []);
      }
      betsByWeek.get(weekKey)!.push(bet);
    });

    // Calculate performance for each week
    Array.from(betsByWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([weekKey, weekBets], index) => {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weeklyBalances: { [userId: string]: number } = {};
        const netChanges: { [userId: string]: number } = {};
        
        // Initialize weekly balances
        users.forEach(user => {
          weeklyBalances[user.id] = 0;
          netChanges[user.id] = 0;
        });

        // Calculate this week's performance
        weekBets.forEach(bet => {
          if (bet.status !== 'won' && bet.status !== 'lost' && bet.status !== 'push') return;

          bet.participants.forEach(userId => {
            if (!weeklyBalances[userId]) return;

            let profit = 0;

            if (bet.type === 'head_to_head' && bet.h2h) {
              const userSide = bet.h2h.sideA.participants.includes(userId) ? 'A' : 'B';
              
              if (bet.status === 'won') {
                const totalPool = bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length);
                const winningSide = userSide === 'A' ? bet.h2h.sideA : bet.h2h.sideB;
                const winnerShare = totalPool / winningSide.participants.length;
                profit = winnerShare - bet.h2h.amount;
              } else if (bet.status === 'lost') {
                profit = -bet.h2h.amount;
              }
            } else {
              const userShare = bet.betDetails.stake / bet.participants.length;
              
              if (bet.status === 'won') {
                const potentialWin = bet.betDetails.odds > 0 
                  ? (userShare * bet.betDetails.odds) / 100
                  : (userShare * 100) / Math.abs(bet.betDetails.odds);
                profit = potentialWin;
              } else if (bet.status === 'lost') {
                profit = -userShare;
              }
            }

            weeklyBalances[userId] += profit;
            netChanges[userId] += profit;
          });
        });

        // Update running totals
        users.forEach(user => {
          runningTotals[user.id] += weeklyBalances[user.id];
        });

        const totalAction = weekBets.reduce((sum, bet) => {
          if (bet.type === 'head_to_head' && bet.h2h) {
            return sum + (bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length));
          }
          return sum + bet.betDetails.stake;
        }, 0);

        weeklyData.push({
          weekNumber: index + 1,
          weekStart,
          weekEnd,
          userBalances: { ...weeklyBalances },
          userRunningTotals: { ...runningTotals },
          totalAction,
          netChange: { ...netChanges }
        });
      });

    return weeklyData;
  };

  const calculateSeasonStats = (): SeasonStats[] => {
    const weeklyPerformance = calculateWeeklyPerformance();
    
    return users.map(user => {
      const userWeeklyData = weeklyPerformance.map((week, index) => ({
        week: week.weekNumber,
        balance: week.userBalances[user.id] || 0,
        runningTotal: week.userRunningTotals[user.id] || 0
      }));

      const totalWinnings = userWeeklyData.reduce((sum, week) => sum + Math.max(0, week.balance), 0);
      const totalLosses = userWeeklyData.reduce((sum, week) => sum + Math.abs(Math.min(0, week.balance)), 0);
      const netProfit = userWeeklyData[userWeeklyData.length - 1]?.runningTotal || 0;
      
      const bestWeek = Math.max(...userWeeklyData.map(week => week.balance));
      const worstWeek = Math.min(...userWeeklyData.map(week => week.balance));

      const userBets = actualBets.filter(bet => bet.participants.includes(user.id));
      const settledBets = userBets.filter(bet => bet.status === 'won' || bet.status === 'lost' || bet.status === 'push');
      const wonBets = userBets.filter(bet => bet.status === 'won').length;
      const winRate = settledBets.length > 0 ? (wonBets / settledBets.length) * 100 : 0;

      const totalAction = userBets.reduce((sum, bet) => {
        if (bet.type === 'head_to_head' && bet.h2h) {
          return sum + bet.h2h.amount;
        }
        return sum + (bet.betDetails.stake / bet.participants.length);
      }, 0);

      return {
        userId: user.id,
        name: user.name,
        totalBets: userBets.length,
        totalWinnings,
        totalLosses,
        netProfit,
        bestWeek,
        worstWeek,
        winRate,
        totalAction,
        weeklyData: userWeeklyData
      };
    });
  };

  const getWeekKey = (date: Date): string => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.toISOString().split('T')[0];
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

  const getPerformanceIcon = (amount: number, size: number = 16) => {
    if (amount > 0) return <TrendingUp size={size} className="text-green-600" />;
    if (amount < 0) return <TrendingDown size={size} className="text-red-600" />;
    return <Minus size={size} className="text-gray-600" />;
  };

  const getPerformanceColor = (amount: number): string => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const seasonStats = calculateSeasonStats().sort((a, b) => b.netProfit - a.netProfit);
  const weeklyPerformance = calculateWeeklyPerformance();

  // Filter data based on selected timeframe
  const getFilteredWeeks = () => {
    const allWeeks = weeklyPerformance;
    switch (selectedTimeframe) {
      case '4weeks': return allWeeks.slice(-4);
      case '8weeks': return allWeeks.slice(-8);
      default: return allWeeks;
    }
  };

  const filteredWeeks = getFilteredWeeks();

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="text-blue-600" size={20} />
              Season Ledger
            </h3>
            <p className="text-sm text-gray-600">Track long-term performance across the season</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-1">
              {(['season', '8weeks', '4weeks'] as const).map(timeframe => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`px-3 py-1 text-sm rounded ${
                    selectedTimeframe === timeframe
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {timeframe === 'season' ? 'All Season' : `${timeframe.slice(0, -5)} Weeks`}
                </button>
              ))}
            </div>
            
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="all">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Season Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{weeklyPerformance.length}</div>
            <div className="text-sm text-gray-600">Weeks Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{actualBets.length}</div>
            <div className="text-sm text-gray-600">Total Bets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(weeklyPerformance.reduce((sum, week) => sum + week.totalAction, 0))}
            </div>
            <div className="text-sm text-gray-600">Season Action</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {settlements.length}
            </div>
            <div className="text-sm text-gray-600">Settlements</div>
          </div>
        </div>
      </div>

      {/* Running Balance Chart (Simplified ASCII/Text Chart) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="text-green-600" size={18} />
          Running Balance Chart
        </h4>
        
        {filteredWeeks.length > 0 ? (
          <div className="space-y-4">
            {(selectedUser === 'all' ? users : users.filter(u => u.id === selectedUser)).map(user => {
              const userStats = seasonStats.find(s => s.userId === user.id);
              if (!userStats) return null;

              return (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {getPerformanceIcon(userStats.netProfit)}
                      <span className={`font-semibold ${getPerformanceColor(userStats.netProfit)}`}>
                        {formatCurrency(userStats.netProfit)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatPercentage(userStats.winRate)} win rate
                    </div>
                  </div>
                  
                  {/* Simple text-based chart */}
                  <div className="bg-gray-50 rounded p-3 font-mono text-sm">
                    <div className="grid grid-cols-1 gap-1">
                      {userStats.weeklyData.filter((_, index) => {
                        if (selectedTimeframe === '4weeks') return index >= userStats.weeklyData.length - 4;
                        if (selectedTimeframe === '8weeks') return index >= userStats.weeklyData.length - 8;
                        return true;
                      }).map((week, index) => (
                        <div key={week.week} className="flex justify-between items-center">
                          <span className="text-gray-600">Week {week.week}:</span>
                          <div className="flex items-center gap-2">
                            <span className={`${getPerformanceColor(week.balance)} font-medium`}>
                              {formatCurrency(week.balance)}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className={`${getPerformanceColor(week.runningTotal)} font-bold`}>
                              {formatCurrency(week.runningTotal)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <BarChart3 className="mx-auto mb-3 text-gray-400" size={48} />
            <p>No seasonal data available yet</p>
            <p className="text-sm mt-1">Complete some weekly settlements to see trends!</p>
          </div>
        )}
      </div>

      {/* Season Leaderboard */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="text-yellow-600" size={18} />
          Season Leaderboard
        </h4>

        <div className="space-y-4">
          {seasonStats.map((stats, index) => (
            <div key={stats.userId} className="border rounded-lg p-4">
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
                    <div className="text-lg font-semibold">{stats.name}</div>
                    <div className="text-sm text-gray-600">
                      {stats.totalBets} bets • {formatPercentage(stats.winRate)} win rate
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-xl font-bold flex items-center gap-1 ${getPerformanceColor(stats.netProfit)}`}>
                    {getPerformanceIcon(stats.netProfit)}
                    {formatCurrency(stats.netProfit)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(stats.totalAction)} wagered
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{formatCurrency(stats.totalWinnings)}</div>
                  <div className="text-gray-600">Total Won</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{formatCurrency(stats.totalLosses)}</div>
                  <div className="text-gray-600">Total Lost</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{formatCurrency(stats.bestWeek)}</div>
                  <div className="text-gray-600">Best Week</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">{formatCurrency(stats.worstWeek)}</div>
                  <div className="text-gray-600">Worst Week</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
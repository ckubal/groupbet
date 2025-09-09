import { useState, useEffect } from 'react';
import { ActualBet } from './ActualBetsTracker';
import { oddsApi, LiveGameScore, PlayerStats } from '@/lib/odds-api';
import { Trophy, Clock, AlertCircle, CheckCircle, XCircle, Minus } from 'lucide-react';

interface LiveGameTrackerProps {
  actualBets: ActualBet[];
  onUpdateBet: (betId: string, updates: Partial<ActualBet>) => void;
}

interface BetWithResult extends ActualBet {
  evaluatedResult?: 'won' | 'lost' | 'push' | 'pending';
  currentStats?: PlayerStats[];
  liveScore?: LiveGameScore;
}

export default function LiveGameTracker({ actualBets, onUpdateBet }: LiveGameTrackerProps) {
  const [liveScores, setLiveScores] = useState<LiveGameScore[]>([]);
  const [playerStats, setPlayerStats] = useState<{ [gameId: string]: PlayerStats[] }>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>();

  useEffect(() => {
    loadLiveData();
    
    // Update every 30 seconds for live games
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      // Get live scores
      const scores = await oddsApi.getLiveScores();
      setLiveScores(scores);

      // Get player stats for games with active bets
      const gameIds = [...new Set(actualBets.map(bet => bet.gameId))];
      const statsPromises = gameIds.map(async gameId => {
        const stats = await oddsApi.getPlayerStats(gameId);
        return { gameId, stats };
      });
      
      const statsResults = await Promise.all(statsPromises);
      const statsMap: { [gameId: string]: PlayerStats[] } = {};
      statsResults.forEach(({ gameId, stats }) => {
        statsMap[gameId] = stats;
      });
      
      setPlayerStats(statsMap);
      setLastUpdate(new Date());

      // Update bet statuses based on live data
      updateBetStatuses(scores, statsMap);
      
    } catch (error) {
      console.error('Failed to load live data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBetStatuses = (scores: LiveGameScore[], stats: { [gameId: string]: PlayerStats[] }) => {
    actualBets.forEach(bet => {
      const liveScore = scores.find(score => score.id === bet.gameId);
      const gameStats = stats[bet.gameId] || [];
      
      if (liveScore) {
        const newResult = oddsApi.evaluateBetResult(bet, liveScore, gameStats);
        
        // Only update if result has changed
        if (bet.status !== newResult && (newResult === 'won' || newResult === 'lost' || newResult === 'push')) {
          onUpdateBet(bet.id, { 
            status: newResult,
            settledAt: liveScore.completed ? new Date() : undefined
          });
        }
        // Update to live if game is in progress
        else if (!liveScore.completed && bet.status === 'pending') {
          onUpdateBet(bet.id, { status: 'live' });
        }
      }
    });
  };

  const getBetsWithResults = (): BetWithResult[] => {
    return actualBets.map(bet => {
      const liveScore = liveScores.find(score => score.id === bet.gameId);
      const gameStats = playerStats[bet.gameId] || [];
      
      let evaluatedResult: 'won' | 'lost' | 'push' | 'pending' = 'pending';
      if (liveScore) {
        evaluatedResult = oddsApi.evaluateBetResult(bet, liveScore, gameStats);
      }

      return {
        ...bet,
        evaluatedResult,
        currentStats: gameStats,
        liveScore
      };
    });
  };

  const getStatusIcon = (status: ActualBet['status']) => {
    switch (status) {
      case 'won': return <CheckCircle className="text-green-600" size={16} />;
      case 'lost': return <XCircle className="text-red-600" size={16} />;
      case 'push': return <Minus className="text-gray-600" size={16} />;
      case 'live': return <Clock className="text-blue-600 animate-pulse" size={16} />;
      default: return <Clock className="text-yellow-600" size={16} />;
    }
  };

  const getStatusColor = (status: ActualBet['status']): string => {
    switch (status) {
      case 'won': return 'bg-green-100 text-green-800 border-green-300';
      case 'lost': return 'bg-red-100 text-red-800 border-red-300';
      case 'push': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'live': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const betsWithResults = getBetsWithResults();
  const activeBets = betsWithResults.filter(bet => bet.status === 'live' || bet.status === 'pending');
  const settledBets = betsWithResults.filter(bet => bet.status === 'won' || bet.status === 'lost' || bet.status === 'push');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="text-yellow-600" size={20} />
            Live Game Tracker
          </h3>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Last updated: {formatTime(lastUpdate)}
              </span>
            )}
            <button
              onClick={loadLiveData}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Updating...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Active/Live Bets */}
      {activeBets.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
            <Clock className="text-blue-600" size={18} />
            Live & Pending Bets ({activeBets.length})
          </h4>
          <div className="space-y-4">
            {activeBets.map(bet => (
              <div key={bet.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-medium text-gray-600 mb-1">
                      {bet.game.awayTeam} @ {bet.game.homeTeam}
                    </div>
                    <div className="font-semibold text-gray-800 text-lg">
                      {bet.betDetails.selection}
                    </div>
                    <div className="text-sm text-gray-600">
                      ${bet.betDetails.stake} at {bet.betDetails.odds > 0 ? '+' : ''}{bet.betDetails.odds}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-3 py-1 rounded text-sm border ${getStatusColor(bet.status)} mb-2`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(bet.status)}
                        {bet.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Score */}
                {bet.liveScore && (
                  <div className="bg-white rounded p-3 mb-3 border">
                    <div className="text-sm font-medium text-gray-700 mb-2">Live Score</div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-lg font-bold">
                          {bet.liveScore.away_team}: {bet.liveScore.scores?.find(s => s.name === bet.liveScore!.away_team)?.score || '0'}
                        </div>
                        <div className="text-lg font-bold">
                          {bet.liveScore.home_team}: {bet.liveScore.scores?.find(s => s.name === bet.liveScore!.home_team)?.score || '0'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {bet.liveScore.completed ? 'Final' : 'Live'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Player Stats (if applicable) */}
                {bet.betDetails.betType === 'player_prop' && bet.currentStats && bet.currentStats.length > 0 && (
                  <div className="bg-white rounded p-3 border">
                    <div className="text-sm font-medium text-gray-700 mb-2">Live Player Stats</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bet.currentStats.slice(0, 3).map(stat => (
                        <div key={stat.player_name} className="text-sm">
                          <div className="font-medium text-gray-800">{stat.player_name} ({stat.position})</div>
                          <div className="text-gray-600">
                            {stat.stats.passing_yards && `${stat.stats.passing_yards} pass yds`}
                            {stat.stats.passing_tds && `, ${stat.stats.passing_tds} pass TDs`}
                            {stat.stats.rushing_yards && `, ${stat.stats.rushing_yards} rush yds`}
                            {stat.stats.receptions && `, ${stat.stats.receptions} rec`}
                            {stat.stats.receiving_yards && `, ${stat.stats.receiving_yards} rec yds`}
                            {stat.stats.receiving_tds && `, ${stat.stats.receiving_tds} rec TDs`}
                            {stat.stats.first_td && `, First TD ✅`}
                            {stat.stats.anytime_td && `, Anytime TD ✅`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bet Evaluation */}
                {bet.evaluatedResult && bet.evaluatedResult !== bet.status && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle size={14} />
                      Projected Result: <span className="font-semibold">{bet.evaluatedResult.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Settled Bets */}
      {settledBets.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-semibold mb-3 text-gray-800">Recently Settled ({settledBets.slice(0, 5).length})</h4>
          <div className="space-y-2">
            {settledBets.slice(0, 5).map(bet => (
              <div key={bet.id} className="border rounded p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-800">{bet.betDetails.selection}</div>
                  <div className="text-xs text-gray-600">{bet.game.awayTeam} @ {bet.game.homeTeam}</div>
                </div>
                <div className="text-right">
                  <div className={`px-2 py-1 rounded text-xs border ${getStatusColor(bet.status)}`}>
                    {getStatusIcon(bet.status)}
                    <span className="ml-1">{bet.status.toUpperCase()}</span>
                  </div>
                  {bet.settledAt && (
                    <div className="text-xs text-gray-500 mt-1">
                      {bet.settledAt.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No active bets */}
      {betsWithResults.length === 0 && (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <Trophy className="mx-auto mb-3 text-gray-400" size={48} />
          <p className="text-gray-600">No bets to track</p>
          <p className="text-sm text-gray-500 mt-1">Add some actual bets to see live tracking!</p>
        </div>
      )}
    </div>
  );
}
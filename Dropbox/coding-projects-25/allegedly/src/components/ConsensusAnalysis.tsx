import { Game } from '@/lib/database';
import { Users, TrendingUp, AlertTriangle, Target } from 'lucide-react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

interface ConsensusAnalysisProps {
  games: Game[];
  selections: UserSelection[];
  users: { id: string; name: string }[];
}

interface ConsensusItem {
  gameId: string;
  game: Game;
  betType: 'spread' | 'total' | 'moneyline';
  consensus: {
    option1: { value: string; count: number; users: string[] };
    option2: { value: string; count: number; users: string[] };
    consensusStrength: number; // 0-100%
    isUnanimous: boolean;
    hasMajority: boolean;
    isDivided: boolean;
  };
}

export default function ConsensusAnalysis({ games, selections, users }: ConsensusAnalysisProps) {
  const analyzeConsensus = (): ConsensusItem[] => {
    const consensusItems: ConsensusItem[] = [];

    games.forEach(game => {
      const gameSelections = selections.filter(s => s.gameId === game.id);
      
      // Analyze spread consensus
      const spreadSelections = gameSelections.filter(s => s.betType === 'spread');
      if (spreadSelections.length >= 3) { // Only show if 3+ people have voted
        const homeUsers = spreadSelections.filter(s => s.selection === 'home').map(s => s.userId);
        const awayUsers = spreadSelections.filter(s => s.selection === 'away').map(s => s.userId);
        const total = homeUsers.length + awayUsers.length;
        const consensusStrength = total > 0 ? Math.abs(homeUsers.length - awayUsers.length) / total * 100 : 0;
        
        consensusItems.push({
          gameId: game.id,
          game,
          betType: 'spread',
          consensus: {
            option1: { value: 'away', count: awayUsers.length, users: awayUsers },
            option2: { value: 'home', count: homeUsers.length, users: homeUsers },
            consensusStrength,
            isUnanimous: consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20,
          }
        });
      }

      // Analyze total consensus
      const totalSelections = gameSelections.filter(s => s.betType === 'total');
      if (totalSelections.length >= 3) {
        const overUsers = totalSelections.filter(s => s.selection === 'over').map(s => s.userId);
        const underUsers = totalSelections.filter(s => s.selection === 'under').map(s => s.userId);
        const total = overUsers.length + underUsers.length;
        const consensusStrength = total > 0 ? Math.abs(overUsers.length - underUsers.length) / total * 100 : 0;
        
        consensusItems.push({
          gameId: game.id,
          game,
          betType: 'total',
          consensus: {
            option1: { value: 'over', count: overUsers.length, users: overUsers },
            option2: { value: 'under', count: underUsers.length, users: underUsers },
            consensusStrength,
            isUnanimous: consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20,
          }
        });
      }

      // Analyze moneyline consensus
      const moneylineSelections = gameSelections.filter(s => s.betType === 'moneyline');
      if (moneylineSelections.length >= 3) {
        const homeUsers = moneylineSelections.filter(s => s.selection === 'home').map(s => s.userId);
        const awayUsers = moneylineSelections.filter(s => s.selection === 'away').map(s => s.userId);
        const total = homeUsers.length + awayUsers.length;
        const consensusStrength = total > 0 ? Math.abs(homeUsers.length - awayUsers.length) / total * 100 : 0;
        
        consensusItems.push({
          gameId: game.id,
          game,
          betType: 'moneyline',
          consensus: {
            option1: { value: 'away', count: awayUsers.length, users: awayUsers },
            option2: { value: 'home', count: homeUsers.length, users: homeUsers },
            consensusStrength,
            isUnanimous: consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20,
          }
        });
      }
    });

    // Sort by consensus strength (unanimous first, then strong consensus)
    return consensusItems.sort((a, b) => b.consensus.consensusStrength - a.consensus.consensusStrength);
  };

  const getConsensusLabel = (item: ConsensusItem): string => {
    const { consensus, betType, game } = item;
    
    if (betType === 'spread') {
      const favorite = consensus.option1.count > consensus.option2.count ? 'away' : 'home';
      const team = favorite === 'away' ? game.awayTeam : game.homeTeam;
      const spread = favorite === 'home' ? game.odds.spread.line : `-${game.odds.spread.line}`;
      return `${team} ${spread}`;
    } else if (betType === 'total') {
      const pick = consensus.option1.count > consensus.option2.count ? 'Over' : 'Under';
      return `${pick} ${game.odds.total.line}`;
    } else {
      const favorite = consensus.option1.count > consensus.option2.count ? 'away' : 'home';
      return favorite === 'away' ? game.awayTeam : game.homeTeam;
    }
  };

  const getBetTypeLabel = (betType: string): string => {
    return betType.charAt(0).toUpperCase() + betType.slice(1);
  };

  const getUserName = (userId: string): string => {
    return users.find(u => u.id === userId)?.name || userId;
  };

  const consensusItems = analyzeConsensus();
  
  // Separate into categories
  const unanimous = consensusItems.filter(item => item.consensus.isUnanimous);
  const strongConsensus = consensusItems.filter(item => item.consensus.hasMajority && !item.consensus.isUnanimous);
  const divided = consensusItems.filter(item => item.consensus.isDivided);

  return (
    <div className="space-y-6">
      {/* Unanimous Picks */}
      {unanimous.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
            <Target className="text-green-600" size={20} />
            Unanimous Picks ({unanimous.length})
          </h3>
          <div className="space-y-2">
            {unanimous.map(item => (
              <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded p-3 border border-green-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-600">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                    <div className="font-semibold text-green-700">
                      {getBetTypeLabel(item.betType)}: {getConsensusLabel(item)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">All {item.consensus.option1.count + item.consensus.option2.count} votes</div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Users size={14} className="text-green-600" />
                      <span className="text-xs text-green-600">100% agree</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Voters: {item.consensus.option1.users.concat(item.consensus.option2.users).map(u => getUserName(u)).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong Consensus */}
      {strongConsensus.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={20} />
            Strong Consensus ({strongConsensus.length})
          </h3>
          <div className="space-y-2">
            {strongConsensus.map(item => {
              const majority = item.consensus.option1.count > item.consensus.option2.count ? item.consensus.option1 : item.consensus.option2;
              const minority = item.consensus.option1.count > item.consensus.option2.count ? item.consensus.option2 : item.consensus.option1;
              
              return (
                <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded p-3 border border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-600">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                      <div className="font-semibold text-blue-700">
                        {getBetTypeLabel(item.betType)}: {getConsensusLabel(item)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{majority.count} vs {minority.count}</div>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <TrendingUp size={14} className="text-blue-600" />
                        <span className="text-xs text-blue-600">{Math.round(item.consensus.consensusStrength)}% consensus</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>Majority ({majority.count}): {majority.users.map(u => getUserName(u)).join(', ')}</div>
                    {minority.count > 0 && (
                      <div>Minority ({minority.count}): {minority.users.map(u => getUserName(u)).join(', ')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divided Opinions */}
      {divided.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="text-orange-600" size={20} />
            Divided Opinions ({divided.length})
          </h3>
          <div className="space-y-2">
            {divided.map(item => (
              <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded p-3 border border-orange-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-600">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                    <div className="font-semibold text-orange-700">
                      {getBetTypeLabel(item.betType)} - Split Decision
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{item.consensus.option1.count} vs {item.consensus.option2.count}</div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <AlertTriangle size={14} className="text-orange-600" />
                      <span className="text-xs text-orange-600">Divided</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  <div>
                    {item.betType === 'spread' ? item.game.awayTeam : 'Over'} ({item.consensus.option1.count}): {item.consensus.option1.users.map(u => getUserName(u)).join(', ') || 'None'}
                  </div>
                  <div>
                    {item.betType === 'spread' ? item.game.homeTeam : 'Under'} ({item.consensus.option2.count}): {item.consensus.option2.users.map(u => getUserName(u)).join(', ') || 'None'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No consensus data */}
      {consensusItems.length === 0 && (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <Target className="mx-auto mb-3 text-gray-400" size={48} />
          <p className="text-gray-600">Need at least 3 votes on a bet to show consensus analysis</p>
          <p className="text-sm text-gray-500 mt-1">Keep voting to see where the group aligns!</p>
        </div>
      )}
    </div>
  );
}
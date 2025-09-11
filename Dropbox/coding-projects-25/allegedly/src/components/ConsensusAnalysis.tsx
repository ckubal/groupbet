import { Game } from '@/lib/database';
import { Users, TrendingUp, AlertTriangle, Target, DollarSign, Plus, Edit3, Check, X } from 'lucide-react';
import { useState } from 'react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

interface BetDetails {
  consensusId: string; // gameId-betType
  amount: number;
  participants: string[];
  betPlacer: string;
  isPlaced: boolean;
}

interface ConsensusAnalysisProps {
  games: Game[];
  selections: UserSelection[];
  users: { id: string; name: string }[];
  betDetails?: BetDetails[];
  onUpdateBetDetails?: (betDetails: BetDetails[]) => void;
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

export default function ConsensusAnalysis({ 
  games, 
  selections, 
  users, 
  betDetails = [], 
  onUpdateBetDetails 
}: ConsensusAnalysisProps) {
  const [editingBet, setEditingBet] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BetDetails>>({});

  const defaultParticipants = ['rosen', 'will', 'do', 'charlie'];
  const defaultBetPlacer = 'rosen';
  const defaultAmount = 200;
  const analyzeConsensus = (): ConsensusItem[] => {
    const consensusItems: ConsensusItem[] = [];

    games.forEach(game => {
      const gameSelections = selections.filter(s => s.gameId === game.id);
      
      // Analyze spread consensus
      const spreadSelections = gameSelections.filter(s => s.betType === 'spread');
      if (spreadSelections.length >= 1) { // Show all games with at least 1 vote
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
            isUnanimous: total === 1 || consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20 && total > 1,
          }
        });
      }

      // Analyze total consensus
      const totalSelections = gameSelections.filter(s => s.betType === 'total');
      if (totalSelections.length >= 1) { // Show all games with at least 1 vote
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
            isUnanimous: total === 1 || consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20 && total > 1,
          }
        });
      }

      // Analyze moneyline consensus
      const moneylineSelections = gameSelections.filter(s => s.betType === 'moneyline');
      if (moneylineSelections.length >= 1) { // Show all games with at least 1 vote
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
            isUnanimous: total === 1 || consensusStrength === 100,
            hasMajority: consensusStrength > 50,
            isDivided: consensusStrength < 20 && total > 1,
          }
        });
      }
    });

    // Sort by net positive votes (highest net difference first)
    return consensusItems.sort((a, b) => {
      const aNetVotes = Math.abs(a.consensus.option1.count - a.consensus.option2.count);
      const bNetVotes = Math.abs(b.consensus.option1.count - b.consensus.option2.count);
      const aTotalVotes = a.consensus.option1.count + a.consensus.option2.count;
      const bTotalVotes = b.consensus.option1.count + b.consensus.option2.count;
      
      // First prioritize by net positive votes (most net difference)
      if (aNetVotes !== bNetVotes) {
        return bNetVotes - aNetVotes;
      }
      
      // Then by total votes
      return bTotalVotes - aTotalVotes;
    });
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

  const getBetDetails = (gameId: string, betType: string): BetDetails | null => {
    const consensusId = `${gameId}-${betType}`;
    return betDetails.find(bet => bet.consensusId === consensusId) || null;
  };

  const handleCreateBet = (gameId: string, betType: string) => {
    const consensusId = `${gameId}-${betType}`;
    const newBet: BetDetails = {
      consensusId,
      amount: defaultAmount,
      participants: [...defaultParticipants],
      betPlacer: defaultBetPlacer,
      isPlaced: true,
    };

    const updatedBetDetails = [...betDetails, newBet];
    onUpdateBetDetails?.(updatedBetDetails);
  };

  const handleEditBet = (bet: BetDetails) => {
    setEditingBet(bet.consensusId);
    setEditForm({ ...bet });
  };

  const handleSaveBet = () => {
    if (!editingBet || !editForm) return;

    const updatedBetDetails = betDetails.map(bet => 
      bet.consensusId === editingBet 
        ? { ...bet, ...editForm } as BetDetails
        : bet
    );

    onUpdateBetDetails?.(updatedBetDetails);
    setEditingBet(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingBet(null);
    setEditForm({});
  };

  const handleDeleteBet = (consensusId: string) => {
    const updatedBetDetails = betDetails.filter(bet => bet.consensusId !== consensusId);
    onUpdateBetDetails?.(updatedBetDetails);
  };

  const renderBetActions = (item: ConsensusItem) => {
    const bet = getBetDetails(item.gameId, item.betType);
    const consensusId = `${item.gameId}-${item.betType}`;

    if (!bet) {
      return (
        <button
          onClick={() => handleCreateBet(item.gameId, item.betType)}
          className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
        >
          <Plus size={12} />
          Place Bet
        </button>
      );
    }

    if (editingBet === consensusId) {
      return (
        <div className="space-y-2 p-3 bg-gray-50 rounded border">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Amount</label>
              <input
                type="number"
                value={editForm.amount || 0}
                onChange={(e) => setEditForm({ ...editForm, amount: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Bet Placer</label>
              <select
                value={editForm.betPlacer || ''}
                onChange={(e) => setEditForm({ ...editForm, betPlacer: e.target.value })}
                className="w-full px-2 py-1 text-xs border rounded"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-gray-600">Participants</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={editForm.participants?.includes(user.id) || false}
                    onChange={(e) => {
                      const currentParticipants = editForm.participants || [];
                      if (e.target.checked) {
                        setEditForm({ 
                          ...editForm, 
                          participants: [...currentParticipants, user.id] 
                        });
                      } else {
                        setEditForm({ 
                          ...editForm, 
                          participants: currentParticipants.filter(p => p !== user.id) 
                        });
                      }
                    }}
                  />
                  {user.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveBet}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
            >
              <Check size={12} />
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
            <DollarSign size={12} />
            ${bet.amount}
          </div>
          <span className="text-gray-600">
            by {getUserName(bet.betPlacer)}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Participants: {bet.participants.map(p => getUserName(p)).join(', ')}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleEditBet(bet)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
          >
            <Edit3 size={10} />
            Edit
          </button>
          <button
            onClick={() => handleDeleteBet(consensusId)}
            className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
          >
            <X size={10} />
            Remove
          </button>
        </div>
      </div>
    );
  };

  const consensusItems = analyzeConsensus();
  
  // Separate into categories
  const unanimous = consensusItems.filter(item => item.consensus.isUnanimous);
  const strongConsensus = consensusItems.filter(item => item.consensus.hasMajority && !item.consensus.isUnanimous);
  const divided = consensusItems.filter(item => item.consensus.isDivided);
  const singleVotes = consensusItems.filter(item => {
    const total = item.consensus.option1.count + item.consensus.option2.count;
    return total === 1;
  });

  return (
    <div className="space-y-8">
      {/* Unanimous Picks */}
      {unanimous.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-green-800 mb-6 flex items-center gap-2">
            <Target className="text-green-600" size={24} />
            Unanimous Picks ({unanimous.length})
          </h3>
          <div className="space-y-4">
            {unanimous.map(item => (
              <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                    <div className="font-semibold text-green-700 text-lg">
                      {getBetTypeLabel(item.betType)}: {getConsensusLabel(item)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">{item.consensus.option1.count + item.consensus.option2.count} votes</div>
                    <div className="flex items-center gap-1 justify-end">
                      <Users size={14} className="text-green-600" />
                      <span className="text-xs text-green-600 font-medium">100% agree</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-600">
                    Voters: {item.consensus.option1.users.concat(item.consensus.option2.users).map(u => getUserName(u)).join(', ')}
                  </div>
                  <div className="ml-4">
                    {renderBetActions(item)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong Consensus */}
      {strongConsensus.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-blue-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={24} />
            Strong Consensus ({strongConsensus.length})
          </h3>
          <div className="space-y-4">
            {strongConsensus.map(item => {
              const majority = item.consensus.option1.count > item.consensus.option2.count ? item.consensus.option1 : item.consensus.option2;
              const minority = item.consensus.option1.count > item.consensus.option2.count ? item.consensus.option2 : item.consensus.option1;
              
              return (
                <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-600 mb-1">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                      <div className="font-semibold text-blue-700 text-lg">
                        {getBetTypeLabel(item.betType)}: {getConsensusLabel(item)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">{majority.count} vs {minority.count}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <TrendingUp size={14} className="text-blue-600" />
                        <span className="text-xs text-blue-600 font-medium">{Math.round(item.consensus.consensusStrength)}% consensus</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3 space-y-1 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">
                        {item.betType === 'spread' ? 
                          `${majority.value === 'home' ? item.game.homeTeam : item.game.awayTeam}` : 
                          majority.value.charAt(0).toUpperCase() + majority.value.slice(1)
                        }
                      </span> ({majority.count}): {majority.users.map(u => getUserName(u)).join(', ')}
                    </div>
                    {minority.count > 0 && (
                      <div>
                        <span className="font-medium">
                          {item.betType === 'spread' ? 
                            `${minority.value === 'home' ? item.game.homeTeam : item.game.awayTeam}` : 
                            minority.value.charAt(0).toUpperCase() + minority.value.slice(1)
                          }
                        </span> ({minority.count}): {minority.users.map(u => getUserName(u)).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    {renderBetActions(item)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divided Opinions */}
      {divided.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-orange-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="text-orange-600" size={24} />
            Divided Opinions ({divided.length})
          </h3>
          <div className="space-y-4">
            {divided.map(item => (
              <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                    <div className="font-semibold text-orange-700 text-lg">
                      {getBetTypeLabel(item.betType)} - Split Decision
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">{item.consensus.option1.count} vs {item.consensus.option2.count}</div>
                    <div className="flex items-center gap-1 justify-end">
                      <AlertTriangle size={14} className="text-orange-600" />
                      <span className="text-xs text-orange-600 font-medium">Divided</span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-3 space-y-1 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">
                      {item.betType === 'spread' ? item.game.awayTeam : 
                       item.betType === 'total' ? 'Over' : 
                       item.game.awayTeam}
                    </span> ({item.consensus.option1.count}): {item.consensus.option1.users.map(u => getUserName(u)).join(', ') || 'None'}
                  </div>
                  <div>
                    <span className="font-medium">
                      {item.betType === 'spread' ? item.game.homeTeam : 
                       item.betType === 'total' ? 'Under' : 
                       item.game.homeTeam}
                    </span> ({item.consensus.option2.count}): {item.consensus.option2.users.map(u => getUserName(u)).join(', ') || 'None'}
                  </div>
                </div>

                <div className="flex justify-end">
                  {renderBetActions(item)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Votes */}
      {singleVotes.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Users className="text-gray-600" size={24} />
            Single Votes ({singleVotes.length})
          </h3>
          <div className="space-y-4">
            {singleVotes.map(item => {
              const singleUser = item.consensus.option1.count > 0 ? item.consensus.option1 : item.consensus.option2;
              
              return (
                <div key={`${item.gameId}-${item.betType}`} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-600 mb-1">{item.game.awayTeam} @ {item.game.homeTeam}</div>
                      <div className="font-semibold text-gray-700 text-lg">
                        {getBetTypeLabel(item.betType)}: {getConsensusLabel(item)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">1 vote</div>
                      <div className="flex items-center gap-1 justify-end">
                        <Users size={14} className="text-gray-600" />
                        <span className="text-xs text-gray-600 font-medium">Looking for more</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-600">
                      Voted by: <span className="font-medium">{getUserName(singleUser.users[0])}</span>
                    </div>
                    <div className="ml-4">
                      {renderBetActions(item)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No consensus data */}
      {consensusItems.length === 0 && (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <Target className="mx-auto mb-3 text-gray-400" size={48} />
          <p className="text-gray-600">No votes yet!</p>
          <p className="text-sm text-gray-500 mt-1">Start studying to see group alignment analysis</p>
        </div>
      )}
    </div>
  );
}
import { Game } from '@/lib/database';
import { Check, ChevronDown, ChevronRight, DollarSign, Edit3, Users, Target } from 'lucide-react';
import { useState, useEffect } from 'react';

interface UserSelection {
  userId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: 'home' | 'away' | 'over' | 'under';
  createdAt: Date;
}

interface PlacedBet {
  id: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline';
  selection: string;
  description: string;
  amount: number;
  odds: number;
  betPlacer: string;
  participants: string[];
  isPlaced: boolean;
  createdAt: Date;
}

interface BetPlacerProps {
  games: Game[];
  selections: UserSelection[];
  users: { id: string; name: string }[];
  currentUserId: string;
  placedBets: PlacedBet[];
  onPlaceBet: (bet: Omit<PlacedBet, 'id' | 'createdAt'>) => void;
  onUpdateBet: (betId: string, updates: Partial<PlacedBet>) => void;
  onDeleteBet: (betId: string) => void;
}

interface RecommendedBet {
  gameId: string;
  game: Game;
  betType: 'spread' | 'total' | 'moneyline';
  selection: string;
  description: string;
  consensusCount: number;
  totalVoters: number;
  consensusPercentage: number;
  participants: string[];
  odds: number;
}

export default function BetPlacer({ 
  games, 
  selections, 
  users,
  currentUserId,
  placedBets,
  onPlaceBet,
  onUpdateBet,
  onDeleteBet
}: BetPlacerProps) {
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());
  const [betForms, setBetForms] = useState<{ [key: string]: {
    amount: number;
    betPlacer: string;
    participants: string[];
    odds: number;
  } }>({});

  // Initialize default form values
  useEffect(() => {
    const recommended = getRecommendedBets();
    const forms: { [key: string]: any } = {};
    
    recommended.forEach(bet => {
      const key = `${bet.gameId}-${bet.betType}-${bet.selection}`;
      forms[key] = {
        amount: 100,
        betPlacer: currentUserId || bet.participants[0] || users[0].id,
        participants: bet.participants.length > 0 ? bet.participants : users.map(u => u.id),
        odds: bet.odds
      };
    });
    
    setBetForms(forms);
  }, [selections, currentUserId]);

  const getRecommendedBets = (): RecommendedBet[] => {
    const recommendations: RecommendedBet[] = [];
    
    games.forEach(game => {
      const gameSelections = selections.filter(s => s.gameId === game.id);
      
      // Process spreads
      const spreadSelections = gameSelections.filter(s => s.betType === 'spread');
      if (spreadSelections.length > 0) {
        const homeCount = spreadSelections.filter(s => s.selection === 'home').length;
        const awayCount = spreadSelections.filter(s => s.selection === 'away').length;
        
        if (homeCount > awayCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'spread',
            selection: 'home',
            description: `${game.homeTeam} ${parseFloat(game.odds.spread.line) > 0 ? '+' : ''}${game.odds.spread.line}`,
            consensusCount: homeCount,
            totalVoters: spreadSelections.length,
            consensusPercentage: (homeCount / spreadSelections.length) * 100,
            participants: spreadSelections.filter(s => s.selection === 'home').map(s => s.userId),
            odds: parseInt(game.odds.spread.odds)
          });
        } else if (awayCount > homeCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'spread',
            selection: 'away',
            description: `${game.awayTeam} ${parseFloat(game.odds.spread.line) < 0 ? '' : '+'}${-parseFloat(game.odds.spread.line)}`,
            consensusCount: awayCount,
            totalVoters: spreadSelections.length,
            consensusPercentage: (awayCount / spreadSelections.length) * 100,
            participants: spreadSelections.filter(s => s.selection === 'away').map(s => s.userId),
            odds: parseInt(game.odds.spread.odds)
          });
        }
      }
      
      // Process totals
      const totalSelections = gameSelections.filter(s => s.betType === 'total');
      if (totalSelections.length > 0) {
        const overCount = totalSelections.filter(s => s.selection === 'over').length;
        const underCount = totalSelections.filter(s => s.selection === 'under').length;
        
        if (overCount > underCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'total',
            selection: 'over',
            description: `Over ${game.odds.total.line}`,
            consensusCount: overCount,
            totalVoters: totalSelections.length,
            consensusPercentage: (overCount / totalSelections.length) * 100,
            participants: totalSelections.filter(s => s.selection === 'over').map(s => s.userId),
            odds: parseInt(game.odds.total.odds)
          });
        } else if (underCount > overCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'total',
            selection: 'under',
            description: `Under ${game.odds.total.line}`,
            consensusCount: underCount,
            totalVoters: totalSelections.length,
            consensusPercentage: (underCount / totalSelections.length) * 100,
            participants: totalSelections.filter(s => s.selection === 'under').map(s => s.userId),
            odds: parseInt(game.odds.total.odds)
          });
        }
      }
      
      // Process moneylines
      const moneylineSelections = gameSelections.filter(s => s.betType === 'moneyline');
      if (moneylineSelections.length > 0) {
        const homeCount = moneylineSelections.filter(s => s.selection === 'home').length;
        const awayCount = moneylineSelections.filter(s => s.selection === 'away').length;
        
        if (homeCount > awayCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'moneyline',
            selection: 'home',
            description: `${game.homeTeam} ML`,
            consensusCount: homeCount,
            totalVoters: moneylineSelections.length,
            consensusPercentage: (homeCount / moneylineSelections.length) * 100,
            participants: moneylineSelections.filter(s => s.selection === 'home').map(s => s.userId),
            odds: parseInt(game.odds.moneyline.home)
          });
        } else if (awayCount > homeCount) {
          recommendations.push({
            gameId: game.id,
            game,
            betType: 'moneyline',
            selection: 'away',
            description: `${game.awayTeam} ML`,
            consensusCount: awayCount,
            totalVoters: moneylineSelections.length,
            consensusPercentage: (awayCount / moneylineSelections.length) * 100,
            participants: moneylineSelections.filter(s => s.selection === 'away').map(s => s.userId),
            odds: parseInt(game.odds.moneyline.away)
          });
        }
      }
    });
    
    // Sort by consensus percentage (strongest consensus first)
    return recommendations.sort((a, b) => b.consensusPercentage - a.consensusPercentage);
  };

  const formatOdds = (odds: number): string => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getUserName = (userId: string): string => {
    return users.find(u => u.id === userId)?.name || userId;
  };

  const toggleBet = (betKey: string) => {
    const newExpanded = new Set(expandedBets);
    if (newExpanded.has(betKey)) {
      newExpanded.delete(betKey);
    } else {
      newExpanded.add(betKey);
    }
    setExpandedBets(newExpanded);
  };

  const handlePlaceBet = (bet: RecommendedBet) => {
    const betKey = `${bet.gameId}-${bet.betType}-${bet.selection}`;
    const form = betForms[betKey];
    
    onPlaceBet({
      gameId: bet.gameId,
      betType: bet.betType,
      selection: bet.selection,
      description: bet.description,
      amount: form.amount,
      odds: form.odds,
      betPlacer: form.betPlacer,
      participants: form.participants,
      isPlaced: true
    });
    
    // Collapse after placing
    toggleBet(betKey);
  };

  const updateBetForm = (betKey: string, updates: Partial<typeof betForms[string]>) => {
    setBetForms(prev => ({
      ...prev,
      [betKey]: { ...prev[betKey], ...updates }
    }));
  };

  const isAlreadyPlaced = (gameId: string, betType: string, selection: string): PlacedBet | undefined => {
    return placedBets.find(bet => 
      bet.gameId === gameId && 
      bet.betType === betType && 
      bet.selection === selection
    );
  };

  const recommendations = getRecommendedBets();
  
  // Group by consensus strength
  const unanimous = recommendations.filter(r => r.consensusPercentage === 100);
  const strong = recommendations.filter(r => r.consensusPercentage >= 75 && r.consensusPercentage < 100);
  const majority = recommendations.filter(r => r.consensusPercentage >= 60 && r.consensusPercentage < 75);

  const renderBetCard = (bet: RecommendedBet) => {
    const betKey = `${bet.gameId}-${bet.betType}-${bet.selection}`;
    const isExpanded = expandedBets.has(betKey);
    const form = betForms[betKey] || { amount: 100, betPlacer: currentUserId, participants: [], odds: bet.odds };
    const existingBet = isAlreadyPlaced(bet.gameId, bet.betType, bet.selection);
    
    return (
      <div
        key={betKey}
        className="glass rounded-2xl border border-white/10 backdrop-blur-xl overflow-hidden"
        style={{
          backgroundColor: existingBet ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          borderColor: existingBet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <button
          onClick={() => !existingBet && toggleBet(betKey)}
          disabled={!!existingBet}
          className="w-full p-4 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-white font-bold text-lg">
                  {bet.description}
                </div>
                {existingBet && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-accent-green/20 rounded-full">
                    <Check size={14} className="text-accent-green" />
                    <span className="text-xs text-accent-green font-medium">Placed</span>
                  </div>
                )}
              </div>
              <div className="text-gray-400 text-sm">
                {bet.game.awayTeam} @ {bet.game.homeTeam}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Users size={14} className="text-accent-blue" />
                  <span className="text-sm text-gray-300">
                    {bet.consensusCount}/{bet.totalVoters} agree ({Math.round(bet.consensusPercentage)}%)
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  Odds: {formatOdds(form.odds)}
                </div>
              </div>
            </div>
            {!existingBet && (
              <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="text-gray-400" size={20} />
              </div>
            )}
          </div>
        </button>

        {isExpanded && !existingBet && (
          <div className="border-t border-white/10 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount</label>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-gray-400" />
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => updateBetForm(betKey, { amount: parseInt(e.target.value) || 0 })}
                    className="flex-1 bg-white/10 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Odds</label>
                <div className="flex items-center gap-2">
                  <Edit3 size={16} className="text-gray-400" />
                  <input
                    type="number"
                    value={form.odds}
                    onChange={(e) => updateBetForm(betKey, { odds: parseInt(e.target.value) || -110 })}
                    className="flex-1 bg-white/10 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Who's placing the bet?</label>
              <div className="grid grid-cols-5 gap-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => updateBetForm(betKey, { betPlacer: user.id })}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      form.betPlacer === user.id
                        ? 'bg-accent-blue text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Who's in on this bet?</label>
              <div className="grid grid-cols-5 gap-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      const current = form.participants || [];
                      if (current.includes(user.id)) {
                        updateBetForm(betKey, { 
                          participants: current.filter(p => p !== user.id) 
                        });
                      } else {
                        updateBetForm(betKey, { 
                          participants: [...current, user.id] 
                        });
                      }
                    }}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      form.participants?.includes(user.id)
                        ? 'bg-accent-green text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePlaceBet(bet)}
                disabled={!form.betPlacer || form.participants.length === 0}
                className="flex-1 px-6 py-3 bg-accent-green hover:bg-accent-green/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
              >
                Place Bet
              </button>
              <button
                onClick={() => toggleBet(betKey)}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-gray-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {existingBet && (
          <div className="border-t border-white/10 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Placed by {getUserName(existingBet.betPlacer)} • ${existingBet.amount} at {formatOdds(existingBet.odds)}
              </div>
              <button
                onClick={() => onDeleteBet(existingBet.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Participants: {existingBet.participants.map(p => getUserName(p)).join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Unanimous Picks */}
      {unanimous.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Target className="text-accent-green" size={20} />
            <h3 className="text-white font-bold text-lg">Unanimous Picks - LOCK IT IN!</h3>
          </div>
          <div className="space-y-3">
            {unanimous.map(renderBetCard)}
          </div>
        </div>
      )}

      {/* Strong Consensus */}
      {strong.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Target className="text-accent-blue" size={20} />
            <h3 className="text-white font-bold text-lg">Strong Consensus</h3>
          </div>
          <div className="space-y-3">
            {strong.map(renderBetCard)}
          </div>
        </div>
      )}

      {/* Majority Picks */}
      {majority.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Target className="text-accent-purple" size={20} />
            <h3 className="text-white font-bold text-lg">Majority Picks</h3>
          </div>
          <div className="space-y-3">
            {majority.map(renderBetCard)}
          </div>
        </div>
      )}

      {recommendations.length === 0 && (
        <div className="text-center py-12">
          <Target className="mx-auto mb-4 text-gray-600" size={48} />
          <p className="text-gray-400 text-lg">No group consensus yet</p>
          <p className="text-gray-500 text-sm mt-1">Head to the study tab to make picks first</p>
        </div>
      )}
    </div>
  );
}
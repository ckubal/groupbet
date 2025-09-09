import { Game, Vote } from '@/lib/database';
import { TrendingUp, Users } from 'lucide-react';

interface AlignmentViewProps {
  games: Game[];
  votes: Vote[];
  userCount: number;
}

interface GameConsensus {
  gameId: string;
  game: Game;
  spread: { up: number; down: number; consensus: number };
  total: { up: number; down: number; consensus: number };
  moneyline: { up: number; down: number; consensus: number };
  overallConsensus: number;
}

export default function AlignmentView({ games, votes, userCount }: AlignmentViewProps) {
  // Calculate consensus for each game and bet type
  const calculateConsensus = (): GameConsensus[] => {
    return games.map(game => {
      const gameVotes = votes.filter(vote => vote.gameId === game.id);
      
      const spreadVotes = gameVotes.filter(vote => vote.betCategory === 'spread');
      const totalVotes = gameVotes.filter(vote => vote.betCategory === 'total');
      const moneylineVotes = gameVotes.filter(vote => vote.betCategory === 'moneyline');
      
      const getConsensusScore = (categoryVotes: Vote[]) => {
        const upVotes = categoryVotes.filter(vote => vote.voteType === 'thumbs-up').length;
        const downVotes = categoryVotes.filter(vote => vote.voteType === 'thumbs-down').length;
        const totalVotes = upVotes + downVotes;
        
        if (totalVotes === 0) return { up: 0, down: 0, consensus: 0 };
        
        // Consensus is the percentage of agreement on the majority opinion
        const majorityVotes = Math.max(upVotes, downVotes);
        const consensus = totalVotes > 0 ? (majorityVotes / userCount) * 100 : 0;
        
        return { up: upVotes, down: downVotes, consensus };
      };
      
      const spread = getConsensusScore(spreadVotes);
      const total = getConsensusScore(totalVotes);
      const moneyline = getConsensusScore(moneylineVotes);
      
      // Overall consensus is the average of all categories
      const overallConsensus = (spread.consensus + total.consensus + moneyline.consensus) / 3;
      
      return {
        gameId: game.id,
        game,
        spread,
        total,
        moneyline,
        overallConsensus,
      };
    });
  };

  const gameConsensus = calculateConsensus()
    .sort((a, b) => b.overallConsensus - a.overallConsensus)
    .filter(item => item.overallConsensus > 0);

  const getConsensusColor = (consensus: number) => {
    if (consensus >= 75) return 'text-green-600 bg-green-100';
    if (consensus >= 50) return 'text-yellow-600 bg-yellow-100';
    if (consensus >= 25) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getConsensusLabel = (consensus: number) => {
    if (consensus >= 75) return 'Strong Consensus';
    if (consensus >= 50) return 'Good Consensus';
    if (consensus >= 25) return 'Some Agreement';
    return 'Low Agreement';
  };

  if (gameConsensus.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <Users className="mx-auto mb-3 text-gray-400" size={48} />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Votes Yet</h3>
        <p className="text-gray-500">
          Start voting on games to see group alignment!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-green-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Group Alignment</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Games ranked by group consensus ({userCount} members)
        </p>
      </div>

      <div className="space-y-4 p-4">
        {gameConsensus.map((item, index) => (
          <div
            key={item.gameId}
            className={`p-4 rounded-lg border-2 ${
              index === 0 ? 'border-green-200 bg-green-50' : 'border-gray-200'
            }`}
          >
            {/* Game Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold text-gray-900">
                  {item.game.awayTeam} @ {item.game.homeTeam}
                </div>
                <div className="text-sm text-gray-500">
                  {item.game.gameTime.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getConsensusColor(item.overallConsensus)}`}>
                  {item.overallConsensus.toFixed(0)}% {getConsensusLabel(item.overallConsensus)}
                </div>
                {index === 0 && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    🎯 Top Pick
                  </div>
                )}
              </div>
            </div>

            {/* Bet Type Breakdown */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              {/* Spread */}
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-medium text-gray-700">Spread</div>
                <div className="text-xs text-gray-600 mt-1">
                  {item.game.odds.spread.line}
                </div>
                <div className={`text-xs font-medium mt-1 ${getConsensusColor(item.spread.consensus).split(' ')[0]}`}>
                  {item.spread.consensus.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">
                  👍 {item.spread.up} 👎 {item.spread.down}
                </div>
              </div>

              {/* Total */}
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-medium text-gray-700">Total</div>
                <div className="text-xs text-gray-600 mt-1">
                  {item.game.odds.total.line}
                </div>
                <div className={`text-xs font-medium mt-1 ${getConsensusColor(item.total.consensus).split(' ')[0]}`}>
                  {item.total.consensus.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">
                  👍 {item.total.up} 👎 {item.total.down}
                </div>
              </div>

              {/* Moneyline */}
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-medium text-gray-700">Moneyline</div>
                <div className="text-xs text-gray-600 mt-1">
                  {item.game.odds.moneyline.home}
                </div>
                <div className={`text-xs font-medium mt-1 ${getConsensusColor(item.moneyline.consensus).split(' ')[0]}`}>
                  {item.moneyline.consensus.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">
                  👍 {item.moneyline.up} 👎 {item.moneyline.down}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
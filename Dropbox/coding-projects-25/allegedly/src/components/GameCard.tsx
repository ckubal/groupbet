import { useState } from 'react';
import { Game } from '@/lib/database';
import { Check, Clock, Sword } from 'lucide-react';
import PlayerPropsDropdown, { PlayerProp } from './PlayerPropsDropdown';
import { ActualBet } from './ActualBetsTracker';
import HeadToHeadBetCreator from './HeadToHeadBetCreator';

interface GameCardProps {
  game: Game;
  userSelections?: {
    spread?: 'home' | 'away' | null;
    total?: 'over' | 'under' | null;
    moneyline?: 'home' | 'away' | null;
  };
  onSelection: (gameId: string, betType: 'spread' | 'total' | 'moneyline', selection: string) => void;
  selectionCounts?: {
    spread: { home: number; away: number };
    total: { over: number; under: number };
    moneyline: { home: number; away: number };
  };
  selectedPlayerProps?: PlayerProp[];
  onPlayerPropSelection?: (prop: PlayerProp) => void;
  onHeadToHeadCreate?: (bet: Omit<ActualBet, 'id' | 'createdAt'>) => void;
  users?: { id: string; name: string }[];
  currentUserId?: string;
}

export default function GameCard({ 
  game, 
  userSelections, 
  onSelection, 
  selectionCounts, 
  selectedPlayerProps = [], 
  onPlayerPropSelection,
  onHeadToHeadCreate,
  users = [],
  currentUserId = ''
}: GameCardProps) {
  const [showH2HCreator, setShowH2HCreator] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeSlotDisplay = (timeSlot: Game['timeSlot']) => {
    switch (timeSlot) {
      case 'thursday':
        return '🌙 Thursday Night';
      case 'sunday-early':
        return '☀️ Sunday 1pm';
      case 'sunday-late':
        return '🌤️ Sunday 4pm';
      case 'sunday-night':
        return '🌙 Sunday Night';
      case 'monday':
        return '🌙 Monday Night';
      default:
        return timeSlot;
    }
  };

  const getStatusColor = (status: Game['status']) => {
    switch (status) {
      case 'scheduled':
        return 'text-blue-600 bg-blue-100';
      case 'live':
        return 'text-red-600 bg-red-100 animate-pulse';
      case 'final':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleSelection = (betType: 'spread' | 'total' | 'moneyline', selection: string) => {
    // If user clicks the same selection, deselect it
    const currentSelection = userSelections?.[betType];
    if (currentSelection === selection) {
      onSelection(game.id, betType, ''); // Empty string to deselect
    } else {
      onSelection(game.id, betType, selection);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-gray-500">
          {getTimeSlotDisplay(game.timeSlot)}
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(game.status)}`}>
          {game.status.toUpperCase()}
        </div>
      </div>

      {/* Teams and Score */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <div className="text-lg font-semibold">{game.awayTeam}</div>
          {game.status !== 'scheduled' && (
            <div className="text-lg font-bold text-gray-700">{game.awayScore}</div>
          )}
        </div>
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">@ {game.homeTeam}</div>
          {game.status !== 'scheduled' && (
            <div className="text-lg font-bold text-gray-700">{game.homeScore}</div>
          )}
        </div>
        {game.status === 'scheduled' && (
          <div className="text-sm text-gray-500 mt-1 text-center flex items-center justify-center gap-1">
            <Clock size={14} />
            {formatTime(game.gameTime)}
          </div>
        )}
      </div>

      {/* Betting Lines */}
      <div className="space-y-4">
        {/* Spread */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Point Spread</div>
          <div className="space-y-2">
            {/* Away Team Spread */}
            <button
              onClick={() => handleSelection('spread', 'away')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.spread === 'away'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {game.awayTeam} {parseFloat(game.odds.spread.line) > 0 ? `+${game.odds.spread.line}` : game.odds.spread.line} ({game.odds.spread.odds})
                </div>
                {userSelections?.spread === 'away' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>

            {/* Home Team Spread */}
            <button
              onClick={() => handleSelection('spread', 'home')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.spread === 'home'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  @ {game.homeTeam} {parseFloat(game.odds.spread.line) < 0 ? `+${Math.abs(parseFloat(game.odds.spread.line))}` : `-${game.odds.spread.line}`} ({game.odds.spread.odds})
                </div>
                {userSelections?.spread === 'home' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Total (Over/Under) */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Total Points</div>
          <div className="space-y-2">
            {/* Over */}
            <button
              onClick={() => handleSelection('total', 'over')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.total === 'over'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Over {game.odds.total.line} ({game.odds.total.odds})
                </div>
                {userSelections?.total === 'over' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>

            {/* Under */}
            <button
              onClick={() => handleSelection('total', 'under')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.total === 'under'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Under {game.odds.total.line} ({game.odds.total.odds})
                </div>
                {userSelections?.total === 'under' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Moneyline */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Moneyline</div>
          <div className="space-y-2">
            {/* Away Team Moneyline */}
            <button
              onClick={() => handleSelection('moneyline', 'away')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.moneyline === 'away'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {game.awayTeam} ({game.odds.moneyline.away})
                </div>
                {userSelections?.moneyline === 'away' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>

            {/* Home Team Moneyline */}
            <button
              onClick={() => handleSelection('moneyline', 'home')}
              className={`w-full p-3 rounded border-2 text-left transition-all ${
                userSelections?.moneyline === 'home'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  @ {game.homeTeam} ({game.odds.moneyline.home})
                </div>
                {userSelections?.moneyline === 'home' && (
                  <Check size={16} className="text-green-600" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Player Props */}
        {onPlayerPropSelection && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">Player Props</div>
            <PlayerPropsDropdown
              gameId={game.id}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              selectedProps={selectedPlayerProps}
              onSelection={onPlayerPropSelection}
            />
            {selectedPlayerProps.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedPlayerProps.map(prop => (
                  <div key={prop.id} className="text-xs bg-white rounded p-2 border">
                    <div className="font-medium text-gray-700">{prop.playerName}</div>
                    <div className="text-gray-600">{prop.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Head to Head Betting */}
        {onHeadToHeadCreate && currentUserId && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">Head to Head</div>
            <button
              onClick={() => setShowH2HCreator(true)}
              className="w-full p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
            >
              <Sword size={16} />
              Create H2H Bet
            </button>
            <div className="text-xs text-gray-500 mt-1 text-center">
              No vig • Core 4 + initiator
            </div>
          </div>
        )}

      </div>

      {/* Head to Head Creator Modal */}
      {showH2HCreator && (
        <HeadToHeadBetCreator
          game={game}
          users={users}
          currentUserId={currentUserId}
          onCreateBet={(bet) => {
            onHeadToHeadCreate?.(bet);
            setShowH2HCreator(false);
          }}
          onClose={() => setShowH2HCreator(false)}
        />
      )}
    </div>
  );
}
'use client';

import { Game, Bet } from '@/types';
import { formatOdds } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface GameCardProps {
  game: Game;
  onBetClick: (game: Game, betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop', selection: string) => void;
  userBets?: Bet[];
}

export default function GameCard({ game, onBetClick, userBets = [] }: GameCardProps) {
  const [showPlayerProps, setShowPlayerProps] = useState(false);
  const [showBettingOptions, setShowBettingOptions] = useState(game.status !== 'final');
  
  // Helper function to get bet status for this selection
  const getBetStatus = (betType: string, selection: string): 'active' | 'won' | 'lost' | null => {
    const bet = userBets.find(bet => 
      bet.betType === betType && 
      (bet.selection === selection || 
       bet.selection.includes(selection.split(' ')[0]) || // For team names
       (betType === 'over_under' && bet.selection.toLowerCase().includes(selection.toLowerCase())))
    );
    
    if (!bet) return null;
    
    switch (bet.status) {
      case 'won':
        return 'won';
      case 'lost':
        return 'lost';
      case 'active':
      default:
        return 'active';
    }
  };

  // Helper function to get background color based on bet status
  const getBetBackgroundColor = (betStatus: 'active' | 'won' | 'lost' | null): string => {
    switch (betStatus) {
      case 'active':
        return 'bg-yellow-100 hover:bg-yellow-200';
      case 'won':
        return 'bg-green-100 hover:bg-green-200';
      case 'lost':
        return 'bg-red-100 hover:bg-red-200';
      default:
        return 'bg-white hover:bg-blue-50';
    }
  };

  const getStatusColor = () => {
    switch (game.status) {
      case 'live':
        return 'border-green-500 bg-green-50';
      case 'final':
        return 'border-gray-300 bg-gray-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getStatusBadge = () => {
    switch (game.status) {
      case 'live':
        return (
          <div className="flex flex-col items-end">
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              LIVE
            </span>
            {(game.quarter || game.timeRemaining) && (
              <span className="text-green-600 text-xs">
                Q{game.quarter || '?'} {game.timeRemaining || ''}
              </span>
            )}
          </div>
        );
      case 'final':
        return <span className="text-gray-600 text-sm font-medium">FINAL</span>;
      default:
        return (
          <span className="flex items-center gap-1 text-gray-500 text-sm">
            <Clock className="w-3 h-3" />
            {format(game.gameTime, 'h:mm a')}
          </span>
        );
    }
  };

  return (
    <div className={`rounded-lg border-2 transition-all ${getStatusColor()}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600">
            {format(game.gameTime, 'EEE, MMM d')}
          </div>
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Away Team */}
          <div className="text-center">
            <div className="font-semibold text-lg">{game.awayTeam}</div>
            {game.status !== 'upcoming' && (
              <div className="text-2xl font-bold mt-1">{game.awayScore || 0}</div>
            )}
          </div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <span className="text-gray-400 text-sm">@</span>
          </div>

          {/* Home Team */}
          <div className="text-center">
            <div className="font-semibold text-lg">{game.homeTeam}</div>
            {game.status !== 'upcoming' && (
              <div className="text-2xl font-bold mt-1">{game.homeScore || 0}</div>
            )}
          </div>
        </div>
      </div>

      {/* For final games, show a toggle button to expand betting options */}
      {game.status === 'final' && !showBettingOptions && (
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setShowBettingOptions(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span>Show Betting Lines</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Betting Grid */}
      {showBettingOptions && (
        <>
          {game.status === 'final' && (
            <div className="px-4 pt-2 pb-1 border-t border-gray-200">
              <button
                onClick={() => setShowBettingOptions(false)}
                className="w-full flex items-center justify-center gap-2 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                <span>Hide Betting Lines</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="p-4 space-y-3">
        {/* Spread */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              console.log('🎯 Bet button clicked:', game.awayTeam, 'spread');
              onBetClick(game, 'spread', `${game.awayTeam} ${game.spread ? (game.spread > 0 ? `-${game.spread}` : `+${Math.abs(game.spread)}`) : '+0'}`);
            }}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('spread', game.awayTeam))
            }`}
            disabled={false}
          >
            <div className="font-medium">{game.awayTeam}</div>
            <div className="text-gray-600">
              {game.spread !== undefined ? (game.spread > 0 ? `-${game.spread}` : `+${Math.abs(game.spread)}`) : '+3'} {game.spreadOdds ? `(${formatOdds(game.spreadOdds)})` : '(-110)'}
            </div>
          </button>
          <button
            onClick={() => onBetClick(game, 'spread', `${game.homeTeam} ${game.spread ? (game.spread > 0 ? `+${game.spread}` : `-${Math.abs(game.spread)}`) : '-3'}`)}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('spread', game.homeTeam))
            }`}
            disabled={false}
          >
            <div className="font-medium">{game.homeTeam}</div>
            <div className="text-gray-600">
              {game.spread !== undefined ? (game.spread > 0 ? `+${game.spread}` : `-${Math.abs(game.spread)}`) : '-3'} {game.spreadOdds ? `(${formatOdds(game.spreadOdds)})` : '(-110)'}
            </div>
          </button>
        </div>

        {/* Total */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onBetClick(game, 'over_under', 'Over')}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('over_under', 'Over'))
            }`}
            disabled={false}
          >
            <div className="font-medium">Over {game.overUnder !== undefined ? game.overUnder : '45'}</div>
            <div className="text-gray-600">{game.overUnderOdds ? formatOdds(game.overUnderOdds) : '(-110)'}</div>
          </button>
          <button
            onClick={() => onBetClick(game, 'over_under', 'Under')}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('over_under', 'Under'))
            }`}
            disabled={false}
          >
            <div className="font-medium">Under {game.overUnder !== undefined ? game.overUnder : '45'}</div>
            <div className="text-gray-600">{game.overUnderOdds ? formatOdds(game.overUnderOdds) : '(-110)'}</div>
          </button>
        </div>

        {/* Moneyline */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onBetClick(game, 'moneyline', `${game.awayTeam} ML`)}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('moneyline', `${game.awayTeam} ML`))
            }`}
            disabled={false}
          >
            <div className="font-medium">{game.awayTeam} ML</div>
            <div className="text-gray-600">{game.awayMoneyline ? formatOdds(game.awayMoneyline) : '(+150)'}</div>
          </button>
          <button
            onClick={() => onBetClick(game, 'moneyline', `${game.homeTeam} ML`)}
            className={`p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer ${
              getBetBackgroundColor(getBetStatus('moneyline', `${game.homeTeam} ML`))
            }`}
            disabled={false}
          >
            <div className="font-medium">{game.homeTeam} ML</div>
            <div className="text-gray-600">{game.homeMoneyline ? formatOdds(game.homeMoneyline) : '(-180)'}</div>
          </button>
        </div>

        {/* Player Props Toggle */}
        <button
          onClick={() => setShowPlayerProps(!showPlayerProps)}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 transition-colors"
        >
          Player Props
          {showPlayerProps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Player Props */}
        {showPlayerProps && (
          <div className="pt-2 border-t border-gray-200">
            {(() => {
              console.log(`🏈 GameCard player props debug for ${game.awayTeam} @ ${game.homeTeam}:`, {
                hasPlayerProps: !!game.playerProps,
                playerPropsLength: game.playerProps?.length || 0,
                playerProps: game.playerProps
              });
              return null;
            })()}
{(() => {
              // Check if game is more than 48 hours away
              const gameTime = new Date(game.gameTime);
              const now = new Date();
              const hoursUntilGame = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
              const isTooEarly = hoursUntilGame > 48;
              
              if (isTooEarly && game.status === 'upcoming') {
                return (
                  <div className="text-center py-6">
                    <div className="text-gray-400 text-sm mb-2">⏰</div>
                    <div className="text-gray-500 text-sm">
                      Player props not available yet
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Check back closer to game time
                    </div>
                  </div>
                );
              }
              
              if (game.playerProps && game.playerProps.length > 0) {
                return (
                  <div className="space-y-2">
                    {/* Group by prop type and organize by team */}
                    {['passing_yards', 'rushing_yards', 'receiving_yards'].map(propType => {
                      const typeProps = game.playerProps?.filter(prop => prop.propType === propType) || [];
                      if (typeProps.length === 0) return null;
                      
                      const typeLabel = propType === 'passing_yards' ? 'Passing Yards' : 
                                       propType === 'rushing_yards' ? 'Rushing Yards' : 'Receiving Yards';
                      
                      // Group players by team - use simple alternating pattern since we don't have team data from odds API
                      const getPlayerTeam = (playerName: string, index: number) => {
                        // Simple alternating pattern: even indices go to home team, odd to away team
                        // This is a temporary solution until we get proper team data from the API
                        return index % 2 === 0 ? game.homeTeam : game.awayTeam;
                      };
                      
                      // Sort players by line (lowest to highest yards) - simple approach
                      const sortedProps = [...typeProps].sort((a, b) => a.line - b.line);
                      
                      return (
                        <div key={propType}>
                          <h4 className="text-xs font-medium text-gray-700 mb-1 px-1">{typeLabel}</h4>
                          <div className="grid gap-1">
                            {sortedProps.map((prop, index) => (
                              <div key={`${game.id}-${prop.playerId}-${index}`} className="grid grid-cols-2 gap-1">
                                <button
                                  onClick={() => onBetClick(game, 'player_prop', `${prop.playerName} Over ${prop.line} ${propType.replace('_', ' ')}`)}
                                  className={`p-2 rounded border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-xs cursor-pointer ${
                                    getBetBackgroundColor(getBetStatus('player_prop', `${prop.playerName} Over`))
                                  }`}
                                >
                                  <div className="font-medium text-left">{prop.playerName}</div>
                                  <div className="text-gray-600 text-left">O {prop.line} ({formatOdds(prop.overOdds)})</div>
                                </button>
                                <button
                                  onClick={() => onBetClick(game, 'player_prop', `${prop.playerName} Under ${prop.line} ${propType.replace('_', ' ')}`)}
                                  className={`p-2 rounded border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 text-xs cursor-pointer ${
                                    getBetBackgroundColor(getBetStatus('player_prop', `${prop.playerName} Under`))
                                  }`}
                                >
                                  <div className="font-medium text-left">{prop.playerName}</div>
                                  <div className="text-gray-600 text-left">U {prop.line} ({formatOdds(prop.underOdds)})</div>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No player props available for this game
                  </p>
                );
              }
            })()}
          </div>
        )}
          </div>
        </>
      )}
    </div>
  );
}
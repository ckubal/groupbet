import { useState } from 'react';
import { Game } from '@/lib/database';
import { Home, Clock, Zap } from 'lucide-react';
import PlayerPropsDropdown, { PlayerProp } from './PlayerPropsDropdown';

interface GameCardHorizontalProps {
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
}

export default function GameCardHorizontal({ 
  game, 
  userSelections, 
  onSelection, 
  selectionCounts, 
  selectedPlayerProps = [], 
  onPlayerPropSelection 
}: GameCardHorizontalProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatOdds = (odds: string | number) => {
    if (typeof odds === 'string') {
      return odds; // Already formatted
    }
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const parseSpreadLine = (line: string) => {
    // Extract team abbreviation and spread value from lines like "KC -2.5" or "DAL -7.5"
    const match = line.match(/([A-Z]{2,4})\s*([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        team: match[1],
        value: parseFloat(match[2])
      };
    }
    return { team: '', value: 0 };
  };

  const getSpreadForTeam = (game: Game, isHome: boolean) => {
    const spreadInfo = parseSpreadLine(game.odds.spread.line);
    
    // Debug logging
    console.log('Spread debug:', {
      line: game.odds.spread.line,
      spreadInfo,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      isHome
    });
    
    // Determine if the spread line is for home or away team
    const homeTeamAbbr = game.homeTeam.split(' ').pop()?.toUpperCase() || '';
    const awayTeamAbbr = game.awayTeam.split(' ').pop()?.toUpperCase() || '';
    
    const isSpreadForHome = homeTeamAbbr.includes(spreadInfo.team.toUpperCase()) || 
                           game.homeTeam.toUpperCase().includes(spreadInfo.team.toUpperCase());
    
    if (isHome) {
      return isSpreadForHome ? spreadInfo.value : -spreadInfo.value;
    } else {
      return isSpreadForHome ? -spreadInfo.value : spreadInfo.value;
    }
  };

  const getBetButtonStyle = (betType: 'spread' | 'total' | 'moneyline', selection: string) => {
    const isSelected = userSelections?.[betType] === selection;
    
    return {
      backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
      border: isSelected ? '1px solid rgba(0, 212, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
      color: isSelected ? '#00d4ff' : '#d1d5db',
      padding: '12px',
      borderRadius: '16px',
      minHeight: '64px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      width: '100%'
    };
  };

  const getSelectionCountClass = (count: number) => {
    if (count === 0) return "text-gray-500";
    if (count === 1) return "text-gray-300";
    if (count === 2) return "text-accent-blue";
    if (count === 3) return "text-accent-green";
    return "text-accent-green font-semibold";
  };

  const getTeamLogo = (teamName: string) => {
    // Placeholder for team logos - will be replaced with actual logos later
    const teamAbbr = teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || '???';
    return (
      <div className="w-8 h-8 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-xs font-bold text-accent-blue">
        {teamAbbr}
      </div>
    );
  };


  return (
    <div 
      className="glass rounded-3xl border border-white/10 backdrop-blur-2xl mb-6 overflow-hidden shadow-2xl"
      style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Game Header */}
      <div className="border-b border-white/10 bg-white/5 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-accent-blue" />
            <span className="text-gray-300 font-medium text-sm">{formatTime(game.gameTime)}</span>
          </div>
          <div className="text-xs text-gray-400 tracking-wide">nfl week 1</div>
        </div>
      </div>

      {/* Teams and Betting Grid */}
      <div className="grid grid-cols-12 gap-0">
        {/* Teams Column */}
        <div className="col-span-12 lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="p-6 space-y-4">
            {/* Away Team */}
            <div className="flex items-center gap-3">
              {getTeamLogo(game.awayTeam)}
              <div>
                <div className="font-semibold text-gray-100 text-sm">{game.awayTeam}</div>
                <div className="text-xs text-gray-400">away</div>
              </div>
            </div>
            {/* Home Team */}
            <div className="flex items-center gap-3">
              {getTeamLogo(game.homeTeam)}
              <div>
                <div className="font-semibold text-gray-100 text-sm flex items-center gap-2">
                  {game.homeTeam} <Home size={12} className="text-accent-blue" />
                </div>
                <div className="text-xs text-gray-400">home</div>
              </div>
            </div>
          </div>
        </div>

        {/* Betting Columns */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-3">
          {/* Spread Column */}
          <div className="border-r border-white/10 p-4">
            <div className="text-center mb-4">
              <div className="text-xs font-bold text-accent-blue tracking-wider uppercase">spread</div>
            </div>
            <div className="space-y-2">
              {/* Away Spread */}
              <button
                onClick={() => onSelection(game.id, 'spread', userSelections?.spread === 'away' ? '' : 'away')}
                style={getBetButtonStyle('spread', 'away')}
              >
                <div className="text-base font-bold">
                  {getSpreadForTeam(game, false) > 0 ? '+' : ''}{getSpreadForTeam(game, false)}
                </div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.spread.odds)}</div>
                {selectionCounts?.spread.away > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.spread.away)}`}>
                    {selectionCounts.spread.away}
                  </div>
                )}
              </button>
              {/* Home Spread */}
              <button
                onClick={() => onSelection(game.id, 'spread', userSelections?.spread === 'home' ? '' : 'home')}
                style={getBetButtonStyle('spread', 'home')}
              >
                <div className="text-base font-bold">
                  {getSpreadForTeam(game, true) > 0 ? '+' : ''}{getSpreadForTeam(game, true)}
                </div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.spread.odds)}</div>
                {selectionCounts?.spread.home > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.spread.home)}`}>
                    {selectionCounts.spread.home}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Total Column */}
          <div className="border-r border-white/10 p-4">
            <div className="text-center mb-4">
              <div className="text-xs font-bold text-accent-green tracking-wider uppercase">total</div>
            </div>
            <div className="space-y-2">
              {/* Over */}
              <button
                onClick={() => onSelection(game.id, 'total', userSelections?.total === 'over' ? '' : 'over')}
                style={getBetButtonStyle('total', 'over')}
              >
                <div className="text-base font-bold">o {game.odds.total.line}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.total.odds)}</div>
                {selectionCounts?.total.over > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.total.over)}`}>
                    {selectionCounts.total.over}
                  </div>
                )}
              </button>
              {/* Under */}
              <button
                onClick={() => onSelection(game.id, 'total', userSelections?.total === 'under' ? '' : 'under')}
                style={getBetButtonStyle('total', 'under')}
              >
                <div className="text-base font-bold">u {game.odds.total.line}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.total.odds)}</div>
                {selectionCounts?.total.under > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.total.under)}`}>
                    {selectionCounts.total.under}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Moneyline Column */}
          <div className="p-4">
            <div className="text-center mb-4">
              <div className="text-xs font-bold text-accent-purple tracking-wider uppercase">moneyline</div>
            </div>
            <div className="space-y-2">
              {/* Away ML */}
              <button
                onClick={() => onSelection(game.id, 'moneyline', userSelections?.moneyline === 'away' ? '' : 'away')}
                style={getBetButtonStyle('moneyline', 'away')}
              >
                <div className="text-base font-bold">{formatOdds(game.odds.moneyline.away)}</div>
                {selectionCounts?.moneyline.away > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.moneyline.away)}`}>
                    {selectionCounts.moneyline.away}
                  </div>
                )}
              </button>
              {/* Home ML */}
              <button
                onClick={() => onSelection(game.id, 'moneyline', userSelections?.moneyline === 'home' ? '' : 'home')}
                style={getBetButtonStyle('moneyline', 'home')}
              >
                <div className="text-base font-bold">{formatOdds(game.odds.moneyline.home)}</div>
                {selectionCounts?.moneyline.home > 0 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded-full ${getSelectionCountClass(selectionCounts.moneyline.home)}`}>
                    {selectionCounts.moneyline.home}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Player Props Section */}
      {onPlayerPropSelection && (
        <div className="border-t border-white/10 bg-white/5 px-6 py-4">
          <PlayerPropsDropdown
            game={game}
            selectedProps={selectedPlayerProps}
            onPropSelect={onPlayerPropSelection}
          />
        </div>
      )}
    </div>
  );
}
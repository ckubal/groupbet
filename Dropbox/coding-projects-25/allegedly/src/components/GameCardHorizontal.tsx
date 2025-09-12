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
  const [showPlayerProps, setShowPlayerProps] = useState(false);
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
      padding: '8px',
      borderRadius: '12px',
      minHeight: '44px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      width: '100%',
      fontSize: '12px'
    };
  };

  const getSelectionCountClass = (count: number) => {
    if (count === 0) return "text-gray-500";
    if (count === 1) return "text-gray-300";
    if (count === 2) return "text-accent-blue";
    if (count === 3) return "text-accent-green";
    return "text-accent-green font-semibold";
  };

  const getTeamAbbreviation = (teamName: string) => {
    const teamAbbrs: { [key: string]: string } = {
      'Ravens': 'BAL',
      'Baltimore Ravens': 'BAL',
      'Chiefs': 'KC',
      'Kansas City Chiefs': 'KC',
      'Cowboys': 'DAL',
      'Dallas Cowboys': 'DAL',
      'Giants': 'NYG',
      'New York Giants': 'NYG',
      '49ers': 'SF',
      'San Francisco 49ers': 'SF',
      'Rams': 'LAR',
      'Los Angeles Rams': 'LAR',
      'Bills': 'BUF',
      'Buffalo Bills': 'BUF',
      'Dolphins': 'MIA',
      'Miami Dolphins': 'MIA',
      'Broncos': 'DEN',
      'Denver Broncos': 'DEN',
      'Raiders': 'LV',
      'Las Vegas Raiders': 'LV'
    };
    return teamAbbrs[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || '???';
  };

  const getTeamLogo = (teamName: string) => {
    const teamAbbr = getTeamAbbreviation(teamName);
    return (
      <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-sm font-bold text-accent-blue">
        {teamAbbr}
      </div>
    );
  };

  const getTeamPlayers = (teamName: string) => {
    // Mock player data - in real app this would come from API
    const teamPlayers: { [key: string]: { qb: string; rb: string; wr: string; qbYards: number; rbYards: number; wrYards: number } } = {
      'Ravens': { qb: 'Jackson', rb: 'Henry', wr: 'Beckham', qbYards: 275.5, rbYards: 85.5, wrYards: 65.5 },
      'Baltimore Ravens': { qb: 'Jackson', rb: 'Henry', wr: 'Beckham', qbYards: 275.5, rbYards: 85.5, wrYards: 65.5 },
      'Chiefs': { qb: 'Mahomes', rb: 'Pacheco', wr: 'Hill', qbYards: 285.5, rbYards: 75.5, wrYards: 95.5 },
      'Kansas City Chiefs': { qb: 'Mahomes', rb: 'Pacheco', wr: 'Hill', qbYards: 285.5, rbYards: 75.5, wrYards: 95.5 },
      'Cowboys': { qb: 'Prescott', rb: 'Pollard', wr: 'Lamb', qbYards: 265.5, rbYards: 70.5, wrYards: 85.5 },
      'Dallas Cowboys': { qb: 'Prescott', rb: 'Pollard', wr: 'Lamb', qbYards: 265.5, rbYards: 70.5, wrYards: 85.5 },
      'Giants': { qb: 'Jones', rb: 'Barkley', wr: 'Robinson', qbYards: 245.5, rbYards: 80.5, wrYards: 60.5 },
      'New York Giants': { qb: 'Jones', rb: 'Barkley', wr: 'Robinson', qbYards: 245.5, rbYards: 80.5, wrYards: 60.5 }
    };
    
    return teamPlayers[teamName] || { 
      qb: teamName.split(' ').pop()?.substring(0, 3) || 'QB',
      rb: teamName.split(' ').pop()?.substring(0, 3) || 'RB',
      wr: teamName.split(' ').pop()?.substring(0, 3) || 'WR',
      qbYards: 255.5,
      rbYards: 75.5,
      wrYards: 70.5
    };
  };

  const handlePlayerPropSelection = (prop: PlayerProp) => {
    if (onPlayerPropSelection) {
      // Check if we're selecting an over/under for a player that already has the opposite selection
      const propKey = `${prop.gameId}-${prop.category}-${prop.playerName}-${prop.line}`;
      const oppositeSelection = prop.id.includes('-over') ? 
        selectedPlayerProps.find(p => p.id.includes('-under') && 
          `${p.gameId}-${p.category}-${p.playerName}-${p.line}` === propKey) :
        selectedPlayerProps.find(p => p.id.includes('-over') && 
          `${p.gameId}-${p.category}-${p.playerName}-${p.line}` === propKey);
      
      // If there's an opposite selection, remove it first
      if (oppositeSelection && onPlayerPropSelection) {
        onPlayerPropSelection(oppositeSelection); // This should deselect the opposite
      }
      
      onPlayerPropSelection(prop);
    }
  };

  const PlayerPropSplitButton = ({ 
    gameId, 
    teamName, 
    playerName, 
    position, 
    yards, 
    overOdds, 
    underOdds, 
    color, 
    category 
  }: {
    gameId: string;
    teamName: string;
    playerName: string;
    position: string;
    yards: number;
    overOdds: string;
    underOdds: string;
    color: string;
    category: string;
  }) => (
    <div 
      style={{
        border: `1px solid ${color}33`,
        borderRadius: '12px',
        height: '48px',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: `${color}0D`
      }}
    >
      {/* Over Half */}
      <button
        onClick={() => handlePlayerPropSelection({
          id: `${gameId}-${position}-${teamName}-over`,
          gameId,
          category,
          playerName,
          description: `${playerName} Over ${yards} Yards`,
          line: yards,
          overPrice: parseInt(overOdds),
          underPrice: parseInt(underOdds),
          bookmaker: 'Mock Sportsbook'
        })}
        style={{
          flex: 1,
          backgroundColor: selectedPlayerProps.some(p => p.id === `${gameId}-${position}-${teamName}-over`) 
            ? `${color}4D` 
            : 'transparent',
          border: 'none',
          borderRight: `1px solid ${color}33`,
          color: selectedPlayerProps.some(p => p.id === `${gameId}-${position}-${teamName}-over`) ? color : `${color}CC`,
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: 'bold'
        }}
      >
        <div style={{ color: 'white' }}>{playerName} {yards}</div>
        <div style={{ fontSize: '10px', color: '#d1d5db' }}>O ({overOdds})</div>
      </button>
      {/* Under Half */}
      <button
        onClick={() => handlePlayerPropSelection({
          id: `${gameId}-${position}-${teamName}-under`,
          gameId,
          category,
          playerName,
          description: `${playerName} Under ${yards} Yards`,
          line: yards,
          overPrice: parseInt(overOdds),
          underPrice: parseInt(underOdds),
          bookmaker: 'Mock Sportsbook'
        })}
        style={{
          flex: 1,
          backgroundColor: selectedPlayerProps.some(p => p.id === `${gameId}-${position}-${teamName}-under`) 
            ? `${color}4D` 
            : 'transparent',
          border: 'none',
          color: selectedPlayerProps.some(p => p.id === `${gameId}-${position}-${teamName}-under`) ? color : `${color}CC`,
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: 'bold'
        }}
      >
        <div style={{ color: 'white' }}>{playerName} {yards}</div>
        <div style={{ fontSize: '10px', color: '#d1d5db' }}>U ({underOdds})</div>
      </button>
    </div>
  );


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
            <span className="text-gray-300 font-medium text-sm">{formatTime(game.gameTime)} • {game.homeTeam.split(' ').slice(0, -1).join(' ')}</span>
          </div>
          <div className="text-xs text-gray-400 tracking-wide">nfl week 1</div>
        </div>
      </div>

      {/* Teams and Betting Grid */}
      <div 
        className="grid-layout"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '120px 1fr 1fr 1fr',
          gap: '0px'
        }}
      >
        {/* Teams Column */}
        <div style={{ paddingLeft: '16px', paddingRight: '8px' }}>
          <div className="text-center mb-2">
            <div className="text-xs font-bold text-gray-400 tracking-wider">&nbsp;</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'center' }}>
            {/* Away Team */}
            <div className="flex items-center justify-center" style={{ height: '48px' }}>
              <div className="text-center">
                <div className="font-bold text-white text-lg">{game.awayTeam.split(' ').pop()}</div>
                <div className="text-gray-400 text-xs">away</div>
              </div>
            </div>
            {/* Home Team */}
            <div className="flex items-center justify-center" style={{ height: '48px' }}>
              <div className="text-center">
                <div className="font-bold text-white text-lg flex items-center gap-1 justify-center">
                  {game.homeTeam.split(' ').pop()} <Home size={12} className="text-accent-blue" />
                </div>
                <div className="text-gray-400 text-xs">home</div>
              </div>
            </div>
          </div>
        </div>

        {/* Spread Column */}
        <div className="p-2">
            <div className="text-center mb-2">
              <div className="text-xs font-bold text-accent-blue tracking-wider">spread</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
              {/* Away Spread */}
              <button
                onClick={() => onSelection(game.id, 'spread', userSelections?.spread === 'away' ? '' : 'away')}
                style={{...getBetButtonStyle('spread', 'away'), height: '48px'}}
              >
                <div className="text-sm font-bold">
                  {getSpreadForTeam(game, false) > 0 ? '+' : ''}{getSpreadForTeam(game, false)}
                </div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.spread.odds)}</div>
              </button>
              {/* Home Spread */}
              <button
                onClick={() => onSelection(game.id, 'spread', userSelections?.spread === 'home' ? '' : 'home')}
                style={{...getBetButtonStyle('spread', 'home'), height: '48px'}}
              >
                <div className="text-sm font-bold">
                  {getSpreadForTeam(game, true) > 0 ? '+' : ''}{getSpreadForTeam(game, true)}
                </div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.spread.odds)}</div>
              </button>
            </div>
          </div>

          {/* Over/Under Column */}
          <div className="p-2">
            <div className="text-center mb-2">
              <div className="text-xs font-bold text-accent-green tracking-wider">o/u</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
              {/* Over */}
              <button
                onClick={() => onSelection(game.id, 'total', userSelections?.total === 'over' ? '' : 'over')}
                style={{...getBetButtonStyle('total', 'over'), height: '48px'}}
              >
                <div className="text-sm font-bold">o{game.odds.total.line}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.total.odds)}</div>
              </button>
              {/* Under */}
              <button
                onClick={() => onSelection(game.id, 'total', userSelections?.total === 'under' ? '' : 'under')}
                style={{...getBetButtonStyle('total', 'under'), height: '48px'}}
              >
                <div className="text-sm font-bold">u{game.odds.total.line}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{formatOdds(game.odds.total.odds)}</div>
              </button>
            </div>
          </div>

          {/* Moneyline Column */}
          <div className="p-2">
            <div className="text-center mb-2">
              <div className="text-xs font-bold text-accent-purple tracking-wider">ml</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
              {/* Away ML */}
              <button
                onClick={() => onSelection(game.id, 'moneyline', userSelections?.moneyline === 'away' ? '' : 'away')}
                style={{...getBetButtonStyle('moneyline', 'away'), height: '48px'}}
              >
                <div className="text-sm font-bold">{formatOdds(game.odds.moneyline.away)}</div>
              </button>
              {/* Home ML */}
              <button
                onClick={() => onSelection(game.id, 'moneyline', userSelections?.moneyline === 'home' ? '' : 'home')}
                style={{...getBetButtonStyle('moneyline', 'home'), height: '48px'}}
              >
                <div className="text-sm font-bold">{formatOdds(game.odds.moneyline.home)}</div>
              </button>
            </div>
          </div>
      </div>

      {/* Player Props Toggle */}
      <div className="border-t border-white/10 px-6 py-4">
        <button
          onClick={() => setShowPlayerProps(!showPlayerProps)}
          className="w-full text-center text-sm text-gray-400 hover:text-accent-blue transition-colors flex items-center justify-center gap-2 bg-transparent border-none"
          style={{ background: 'none', border: 'none', padding: '0' }}
        >
          <span className="tracking-wide">player props</span>
          <div className={`text-xs transform transition-transform ${showPlayerProps ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </button>
      </div>

      {/* Player Props Section */}
      {showPlayerProps && (
        <div className="border-t border-white/10 bg-white/5 px-6 py-4">
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px'
            }}
          >
            {/* QB Yards Column */}
            <div>
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-orange-500 tracking-wider">qb yds</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Away Team QB */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.awayTeam}
                  playerName={getTeamPlayers(game.awayTeam).qb}
                  position="qb"
                  yards={getTeamPlayers(game.awayTeam).qbYards}
                  overOdds="-110"
                  underOdds="-110"
                  color="#fb923c"
                  category="player_pass_yds"
                />
                {/* Home Team QB */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.homeTeam}
                  playerName={getTeamPlayers(game.homeTeam).qb}
                  position="qb"
                  yards={getTeamPlayers(game.homeTeam).qbYards}
                  overOdds="-110"
                  underOdds="-110"
                  color="#fb923c"
                  category="player_pass_yds"
                />
              </div>
            </div>

            {/* RB Yards Column */}
            <div>
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-red-500 tracking-wider">rb yds</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Away Team RB */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.awayTeam}
                  playerName={getTeamPlayers(game.awayTeam).rb}
                  position="rb"
                  yards={getTeamPlayers(game.awayTeam).rbYards}
                  overOdds="-115"
                  underOdds="-105"
                  color="#ef4444"
                  category="player_rush_yds"
                />
                {/* Home Team RB */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.homeTeam}
                  playerName={getTeamPlayers(game.homeTeam).rb}
                  position="rb"
                  yards={getTeamPlayers(game.homeTeam).rbYards}
                  overOdds="-115"
                  underOdds="-105"
                  color="#ef4444"
                  category="player_rush_yds"
                />
              </div>
            </div>

            {/* WR Yards Column */}
            <div>
              <div className="text-center mb-3">
                <div className="text-xs font-bold text-yellow-500 tracking-wider">wr yds</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Away Team WR */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.awayTeam}
                  playerName={getTeamPlayers(game.awayTeam).wr}
                  position="wr"
                  yards={getTeamPlayers(game.awayTeam).wrYards}
                  overOdds="+105"
                  underOdds="-125"
                  color="#f59e0b"
                  category="player_receptions"
                />
                {/* Home Team WR */}
                <PlayerPropSplitButton 
                  gameId={game.id}
                  teamName={game.homeTeam}
                  playerName={getTeamPlayers(game.homeTeam).wr}
                  position="wr"
                  yards={getTeamPlayers(game.homeTeam).wrYards}
                  overOdds="+105"
                  underOdds="-125"
                  color="#f59e0b"
                  category="player_receptions"
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
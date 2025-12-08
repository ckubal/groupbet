/**
 * Consistent Game ID Generation System
 * 
 * This ensures that game IDs are identical across ESPN, Odds API, and Firebase
 * by using a deterministic formula based on game date and teams.
 * 
 * Format: YYYYMMDD-awayteam-hometeam (all lowercase, no spaces)
 * Example: 20250914-newyorkjets-newenglandpatriots
 */

import crypto from 'crypto';

/**
 * Team name normalization mapping to ensure consistency
 */
const TEAM_NORMALIZATIONS: Record<string, string> = {
  // Full names to short versions
  'Arizona Cardinals': 'cardinals',
  'Atlanta Falcons': 'falcons',
  'Baltimore Ravens': 'ravens',
  'Buffalo Bills': 'bills',
  'Carolina Panthers': 'panthers',
  'Chicago Bears': 'bears',
  'Cincinnati Bengals': 'bengals',
  'Cleveland Browns': 'browns',
  'Dallas Cowboys': 'cowboys',
  'Denver Broncos': 'broncos',
  'Detroit Lions': 'lions',
  'Green Bay Packers': 'packers',
  'Houston Texans': 'texans',
  'Indianapolis Colts': 'colts',
  'Jacksonville Jaguars': 'jaguars',
  'Kansas City Chiefs': 'chiefs',
  'Las Vegas Raiders': 'raiders',
  'Los Angeles Chargers': 'chargers',
  'Los Angeles Rams': 'rams',
  'Miami Dolphins': 'dolphins',
  'Minnesota Vikings': 'vikings',
  'New England Patriots': 'patriots',
  'New Orleans Saints': 'saints',
  'New York Giants': 'giants',
  'New York Jets': 'jets',
  'Philadelphia Eagles': 'eagles',
  'Pittsburgh Steelers': 'steelers',
  'San Francisco 49ers': '49ers',
  'Seattle Seahawks': 'seahawks',
  'Tampa Bay Buccaneers': 'buccaneers',
  'Tennessee Titans': 'titans',
  'Washington Commanders': 'commanders',
  // Alternative names
  'Washington Football Team': 'commanders',
  'Washington': 'commanders',
  'Oakland Raiders': 'raiders',
  'San Diego Chargers': 'chargers',
  'St. Louis Rams': 'rams',
  // Short versions (already normalized)
  'Cardinals': 'cardinals',
  'Falcons': 'falcons',
  'Ravens': 'ravens',
  'Bills': 'bills',
  'Panthers': 'panthers',
  'Bears': 'bears',
  'Bengals': 'bengals',
  'Browns': 'browns',
  'Cowboys': 'cowboys',
  'Broncos': 'broncos',
  'Lions': 'lions',
  'Packers': 'packers',
  'Texans': 'texans',
  'Colts': 'colts',
  'Jaguars': 'jaguars',
  'Chiefs': 'chiefs',
  'Raiders': 'raiders',
  'Chargers': 'chargers',
  'Rams': 'rams',
  'Dolphins': 'dolphins',
  'Vikings': 'vikings',
  'Patriots': 'patriots',
  'Saints': 'saints',
  'Giants': 'giants',
  'Jets': 'jets',
  'Eagles': 'eagles',
  'Steelers': 'steelers',
  '49ers': '49ers',
  'Seahawks': 'seahawks',
  'Buccaneers': 'buccaneers',
  'Titans': 'titans',
  'Commanders': 'commanders',
};

/**
 * Normalize team name to a consistent format
 */
export function normalizeTeamName(teamName: string): string {
  // First check if we have a direct mapping
  const directMapping = TEAM_NORMALIZATIONS[teamName];
  if (directMapping) {
    return directMapping;
  }
  
  // Otherwise, clean it up
  return teamName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

/**
 * Generate a consistent game ID based on date and teams
 * This is the SINGLE SOURCE OF TRUTH for game IDs
 */
export function generateGameId(gameTime: Date | string, awayTeam: string, homeTeam: string): string {
  // Ensure we have a Date object
  const date = typeof gameTime === 'string' ? new Date(gameTime) : gameTime;
  
  // Format date as YYYYMMDD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  // Normalize team names
  const awayNormalized = normalizeTeamName(awayTeam);
  const homeNormalized = normalizeTeamName(homeTeam);
  
  // Create deterministic ID
  const gameId = `${dateStr}-${awayNormalized}-${homeNormalized}`;
  
  // For debugging
  console.log(`🆔 Generated Game ID: ${gameId}`);
  console.log(`   Date: ${dateStr} (from ${date.toISOString()})`);
  console.log(`   Away: ${awayTeam} → ${awayNormalized}`);
  console.log(`   Home: ${homeTeam} → ${homeNormalized}`);
  
  // Create a shorter hash for storage efficiency if needed
  const hash = crypto.createHash('md5').update(gameId).digest('hex');
  
  return hash; // Return hash for now to match existing bet IDs
}

/**
 * Create a human-readable game ID (for debugging)
 */
export function generateReadableGameId(gameTime: Date | string, awayTeam: string, homeTeam: string): string {
  const date = typeof gameTime === 'string' ? new Date(gameTime) : gameTime;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const awayNormalized = normalizeTeamName(awayTeam);
  const homeNormalized = normalizeTeamName(homeTeam);
  
  return `${dateStr}-${awayNormalized}-${homeNormalized}`;
}

/**
 * Match games by teams and date (for finding games across different APIs)
 * STRICT MODE: Also checks that times are within 2 hours of each other to prevent wrong matches
 */
export function doGamesMatch(
  game1: { gameTime: Date | string; awayTeam: string; homeTeam: string },
  game2: { gameTime: Date | string; awayTeam: string; homeTeam: string },
  strictTimeCheck: boolean = true
): boolean {
  // Check if teams match (normalized)
  const away1 = normalizeTeamName(game1.awayTeam);
  const home1 = normalizeTeamName(game1.homeTeam);
  const away2 = normalizeTeamName(game2.awayTeam);
  const home2 = normalizeTeamName(game2.homeTeam);
  
  if (away1 !== away2 || home1 !== home2) {
    return false;
  }
  
  // Check if dates match (same day)
  const date1 = typeof game1.gameTime === 'string' ? new Date(game1.gameTime) : game1.gameTime;
  const date2 = typeof game2.gameTime === 'string' ? new Date(game2.gameTime) : game2.gameTime;
  
  const sameDay = (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
  
  if (!sameDay) {
    return false;
  }
  
  // STRICT: Also check that game times are within 2 hours of each other
  // This prevents matching wrong games on the same day (e.g., early vs late games)
  if (strictTimeCheck) {
    const timeDiff = Math.abs(date1.getTime() - date2.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff > 2) {
      console.warn(`⚠️ Games match teams/date but times differ by ${hoursDiff.toFixed(1)} hours:`, {
        game1: `${game1.awayTeam} @ ${game1.homeTeam} at ${date1.toISOString()}`,
        game2: `${game2.awayTeam} @ ${game2.homeTeam} at ${date2.toISOString()}`
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Regenerate all game IDs for a list of games
 */
export function regenerateGameIds<T extends { gameTime: Date | string; awayTeam: string; homeTeam: string }>(
  games: T[]
): (T & { id: string; readableId: string })[] {
  return games.map(game => ({
    ...game,
    id: generateGameId(game.gameTime, game.awayTeam, game.homeTeam),
    readableId: generateReadableGameId(game.gameTime, game.awayTeam, game.homeTeam)
  }));
}
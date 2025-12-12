/**
 * NFL Over/Under Analysis Adjustments
 * 
 * This module provides functions to calculate various adjustments
 * that impact total points scored in NFL games.
 */

export interface WeatherAdjustment {
  adjustment: number;
  reason: string;
}

export interface RestDaysInfo {
  awayRestDays: number;
  homeRestDays: number;
  restAdvantage: 'away' | 'home' | 'none';
  restAdvantageDays: number;
}

export interface TravelAdjustment {
  adjustment: number;
  reason: string;
}

export interface GameTypeAdjustment {
  adjustment: number;
  reason: string;
}

/**
 * NFL Team Divisions
 * Maps team names to their division
 */
const NFL_TEAM_DIVISIONS: Record<string, string> = {
  // AFC East
  'Buffalo Bills': 'AFC East',
  'Miami Dolphins': 'AFC East',
  'New England Patriots': 'AFC East',
  'New York Jets': 'AFC East',
  
  // AFC North
  'Baltimore Ravens': 'AFC North',
  'Cincinnati Bengals': 'AFC North',
  'Cleveland Browns': 'AFC North',
  'Pittsburgh Steelers': 'AFC North',
  
  // AFC South
  'Houston Texans': 'AFC South',
  'Indianapolis Colts': 'AFC South',
  'Jacksonville Jaguars': 'AFC South',
  'Tennessee Titans': 'AFC South',
  
  // AFC West
  'Denver Broncos': 'AFC West',
  'Kansas City Chiefs': 'AFC West',
  'Las Vegas Raiders': 'AFC West',
  'Los Angeles Chargers': 'AFC West',
  
  // NFC East
  'Dallas Cowboys': 'NFC East',
  'New York Giants': 'NFC East',
  'Philadelphia Eagles': 'NFC East',
  'Washington Commanders': 'NFC East',
  
  // NFC North
  'Chicago Bears': 'NFC North',
  'Detroit Lions': 'NFC North',
  'Green Bay Packers': 'NFC North',
  'Minnesota Vikings': 'NFC North',
  
  // NFC South
  'Atlanta Falcons': 'NFC South',
  'Carolina Panthers': 'NFC South',
  'New Orleans Saints': 'NFC South',
  'Tampa Bay Buccaneers': 'NFC South',
  
  // NFC West
  'Arizona Cardinals': 'NFC West',
  'Los Angeles Rams': 'NFC West',
  'San Francisco 49ers': 'NFC West',
  'Seattle Seahawks': 'NFC West',
};

/**
 * NFL Team Location and Timezone Data
 * Maps team names to their home city timezone
 */
const NFL_TEAM_TIMEZONES: Record<string, string> = {
  // AFC East
  'Buffalo Bills': 'America/New_York',
  'Miami Dolphins': 'America/New_York',
  'New England Patriots': 'America/New_York',
  'New York Jets': 'America/New_York',
  
  // AFC North
  'Baltimore Ravens': 'America/New_York',
  'Cincinnati Bengals': 'America/New_York',
  'Cleveland Browns': 'America/New_York',
  'Pittsburgh Steelers': 'America/New_York',
  
  // AFC South
  'Houston Texans': 'America/Chicago',
  'Indianapolis Colts': 'America/New_York',
  'Jacksonville Jaguars': 'America/New_York',
  'Tennessee Titans': 'America/Chicago',
  
  // AFC West
  'Denver Broncos': 'America/Denver',
  'Kansas City Chiefs': 'America/Chicago',
  'Las Vegas Raiders': 'America/Los_Angeles',
  'Los Angeles Chargers': 'America/Los_Angeles',
  
  // NFC East
  'Dallas Cowboys': 'America/Chicago',
  'New York Giants': 'America/New_York',
  'Philadelphia Eagles': 'America/New_York',
  'Washington Commanders': 'America/New_York',
  
  // NFC North
  'Chicago Bears': 'America/Chicago',
  'Detroit Lions': 'America/New_York',
  'Green Bay Packers': 'America/Chicago',
  'Minnesota Vikings': 'America/Chicago',
  
  // NFC South
  'Atlanta Falcons': 'America/New_York',
  'Carolina Panthers': 'America/New_York',
  'New Orleans Saints': 'America/Chicago',
  'Tampa Bay Buccaneers': 'America/New_York',
  
  // NFC West
  'Arizona Cardinals': 'America/Phoenix', // No DST
  'Los Angeles Rams': 'America/Los_Angeles',
  'San Francisco 49ers': 'America/Los_Angeles',
  'Seattle Seahawks': 'America/Los_Angeles',
};

/**
 * Indoor stadiums (no weather impact)
 */
const INDOOR_STADIUMS = new Set([
  'AT&T Stadium', // Dallas
  'Ford Field', // Detroit
  'Lucas Oil Stadium', // Indianapolis
  'Mercedes-Benz Stadium', // Atlanta
  'Mercedes-Benz Superdome', // New Orleans
  'NRG Stadium', // Houston
  'SoFi Stadium', // LA Rams/Chargers
  'U.S. Bank Stadium', // Minnesota
  'Allegiant Stadium', // Las Vegas
  'State Farm Stadium', // Arizona (retractable roof, usually closed)
]);

/**
 * High altitude venues (affects passing game)
 */
const HIGH_ALTITUDE_VENUES: Record<string, number> = {
  'Empower Field at Mile High': 5280, // Denver
  'Sports Authority Field at Mile High': 5280, // Denver (old name)
};

/**
 * Get team's timezone
 */
export function getTeamTimezone(teamName: string): string {
  return NFL_TEAM_TIMEZONES[teamName] || 'America/New_York'; // Default to Eastern
}

/**
 * Check if two teams are in the same division
 */
export function isDivisionalGame(team1: string, team2: string): boolean {
  const div1 = NFL_TEAM_DIVISIONS[team1];
  const div2 = NFL_TEAM_DIVISIONS[team2];
  return div1 !== undefined && div2 !== undefined && div1 === div2;
}

/**
 * Get team's division
 */
export function getTeamDivision(teamName: string): string | undefined {
  return NFL_TEAM_DIVISIONS[teamName];
}

/**
 * Calculate weather adjustment based on weather conditions
 * Based on historical NFL data showing weather impacts on scoring
 */
export function calculateWeatherAdjustment(weather: {
  isIndoor?: boolean;
  temperature?: number;
  windSpeed?: number;
  precipitation?: string;
  condition?: string;
}): WeatherAdjustment {
  // Indoor games have no weather impact
  if (weather.isIndoor) {
    return { adjustment: 0, reason: 'Indoor stadium - no weather impact' };
  }

  let adjustment = 0;
  const reasons: string[] = [];

  // Temperature adjustments
  if (weather.temperature !== undefined) {
    if (weather.temperature < 10) {
      // Extreme cold: -3 to -5 points
      adjustment -= 4;
      reasons.push(`Extreme cold (${weather.temperature}°F): -4.0`);
    } else if (weather.temperature < 20) {
      // Very cold: -2.5 to -4 points
      adjustment -= 3;
      reasons.push(`Very cold (${weather.temperature}°F): -3.0`);
    } else if (weather.temperature < 32) {
      // Cold: -1.5 to -2.5 points
      adjustment -= 2;
      reasons.push(`Cold (${weather.temperature}°F): -2.0`);
    } else if (weather.temperature > 85) {
      // Very hot: -0.5 to -1 point (fatigue)
      adjustment -= 0.75;
      reasons.push(`Very hot (${weather.temperature}°F): -0.75`);
    }
  }

  // Precipitation adjustments
  if (weather.precipitation === 'Snow') {
    adjustment -= 3.5; // Snow: -3 to -5 points
    reasons.push('Snow: -3.5');
  } else if (weather.precipitation === 'Rain') {
    // Check condition for heavy rain
    const conditionLower = (weather.condition || '').toLowerCase();
    if (conditionLower.includes('heavy') || conditionLower.includes('torrential')) {
      adjustment -= 4; // Heavy rain: -3 to -5 points
      reasons.push('Heavy rain: -4.0');
    } else {
      adjustment -= 2.5; // Regular rain: -2 to -3 points
      reasons.push('Rain: -2.5');
    }
  }

  // Wind adjustments
  if (weather.windSpeed !== undefined) {
    if (weather.windSpeed > 20) {
      // Strong wind: -2 to -4 points
      adjustment -= 3;
      reasons.push(`Strong wind (${weather.windSpeed} mph): -3.0`);
    } else if (weather.windSpeed > 15) {
      // Moderate wind: -1 to -2 points
      adjustment -= 1.5;
      reasons.push(`Wind (${weather.windSpeed} mph): -1.5`);
    }
  }

  // Combined effects (wind + precipitation can compound)
  if (weather.precipitation && weather.precipitation !== 'None' && weather.windSpeed && weather.windSpeed > 15) {
    adjustment -= 1; // Additional penalty for bad conditions
    reasons.push('Wind + precipitation: -1.0');
  }

  // Cap maximum adjustment at -6 points (extreme conditions)
  if (adjustment < -6) {
    adjustment = -6;
    reasons.push('Capped at -6.0 (extreme conditions)');
  }

  return {
    adjustment: Math.round(adjustment * 10) / 10,
    reason: reasons.length > 0 ? reasons.join(', ') : 'No weather impact',
  };
}

/**
 * Calculate rest days between a team's previous game and current game
 */
export async function calculateRestDays(
  teamName: string,
  currentGameTime: Date,
  currentWeek: number,
  espnApi: any
): Promise<number> {
  // Find the team's most recent game before this one
  for (let week = currentWeek - 1; week >= Math.max(1, currentWeek - 4); week--) {
    try {
      const scoreboard = await espnApi.getScoreboard(week);
      if (!scoreboard || !scoreboard.events) continue;

      for (const event of scoreboard.events) {
        const competition = event.competitions[0];
        if (!competition) continue;

        const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');

        if (!homeCompetitor || !awayCompetitor) continue;

        const homeTeam = homeCompetitor.team.displayName;
        const awayTeam = awayCompetitor.team.displayName;

        // Check if this team played in this game
        if (homeTeam === teamName || awayTeam === teamName) {
          // Only count completed games
          if (competition.status.type.completed) {
            const previousGameTime = new Date(event.date);
            const restDays = Math.floor(
              (currentGameTime.getTime() - previousGameTime.getTime()) / (1000 * 60 * 60 * 24)
            );
            return restDays;
          }
        }
      }
    } catch (error) {
      console.warn(`Error fetching Week ${week} for rest days calculation:`, error);
    }
  }

  // Default to 7 days if we can't find previous game (normal rest)
  return 7;
}

/**
 * Get rest days information for both teams
 */
export async function getRestDaysInfo(
  awayTeam: string,
  homeTeam: string,
  currentGameTime: Date,
  currentWeek: number,
  espnApi: any
): Promise<RestDaysInfo> {
  const [awayRestDays, homeRestDays] = await Promise.all([
    calculateRestDays(awayTeam, currentGameTime, currentWeek, espnApi),
    calculateRestDays(homeTeam, currentGameTime, currentWeek, espnApi),
  ]);

  const restDiff = Math.abs(awayRestDays - homeRestDays);
  let restAdvantage: 'away' | 'home' | 'none' = 'none';
  let restAdvantageDays = 0;

  if (restDiff >= 3) {
    if (awayRestDays > homeRestDays) {
      restAdvantage = 'away';
      restAdvantageDays = restDiff;
    } else {
      restAdvantage = 'home';
      restAdvantageDays = restDiff;
    }
  }

  return {
    awayRestDays,
    homeRestDays,
    restAdvantage,
    restAdvantageDays,
  };
}

/**
 * Calculate rest days adjustment
 * 
 * NOTE: Rest days adjustments are REMOVED because they affect both offense and defense similarly.
 * When a team has short rest:
 * - Their offense is tired (fewer points scored)
 * - Their defense is also tired (more points allowed)
 * Net effect on TOTAL points is minimal.
 * 
 * The Thursday/Monday night adjustments already capture the short-rest effect when BOTH teams
 * have short rest. Individual team rest differences don't meaningfully affect totals.
 */
export function calculateRestDaysAdjustment(restDaysInfo: RestDaysInfo): { adjustment: number; reasons: string[] } {
  // Removed: Rest day effects cancel out (affects both offense and defense)
  // Thursday/Monday night adjustments already capture short-rest effects
  return {
    adjustment: 0,
    reasons: ['Rest effects cancel out (affects both offense and defense)'],
  };
}

/**
 * Calculate travel and time zone adjustment
 * 
 * NOTE: Travel/timezone effects are REMOVED because they affect both offense and defense similarly.
 * When a team is tired from travel or time zone change:
 * - Their offense struggles (fewer points scored)
 * - Their defense also struggles (more points allowed)
 * Net effect on TOTAL points is minimal or neutral, so we don't adjust for this.
 * 
 * Historical data shows travel/timezone effects are more about win probability than total points.
 */
export function calculateTravelAdjustment(
  awayTeam: string,
  homeTeam: string,
  gameTime: Date,
  venue?: { fullName?: string; address?: { city?: string; state?: string } }
): TravelAdjustment {
  // Removed: Travel/timezone adjustments don't meaningfully affect totals
  // because both offense and defense are affected similarly
  return {
    adjustment: 0,
    reason: 'Travel/timezone effects cancel out (affects both offense and defense)',
  };
}

/**
 * Calculate altitude adjustment (Denver games)
 */
export function calculateAltitudeAdjustment(venue?: { fullName?: string }): { adjustment: number; reason: string } {
  if (!venue?.fullName) {
    return { adjustment: 0, reason: 'Venue unknown' };
  }

  const venueName = venue.fullName;
  const altitude = HIGH_ALTITUDE_VENUES[venueName];

  if (altitude && altitude >= 5000) {
    // Denver: +1 to +2 points (thinner air = longer passes, more scoring)
    return { adjustment: 1.5, reason: `High altitude venue (${altitude} ft): +1.5` };
  }

  return { adjustment: 0, reason: 'No altitude impact' };
}

/**
 * Get game type adjustment based on day/time
 * Based on historical NFL data:
 * - Thursday Night: -2.5 points (short rest, lower scoring)
 * - Monday Night: -1.0 points (slightly lower scoring)
 * - Sunday games: no adjustment
 */
export function getGameTypeAdjustment(gameTime: Date): GameTypeAdjustment {
  const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = easternDate.getDay(); // 0=Sunday, 1=Monday, 4=Thursday
  
  if (dayOfWeek === 4) { // Thursday
    return { adjustment: -2.5, reason: 'Thursday Night (short rest, historically lower scoring)' };
  } else if (dayOfWeek === 1) { // Monday
    return { adjustment: -1.0, reason: 'Monday Night (slightly lower scoring)' };
  }
  
  return { adjustment: 0, reason: 'Sunday game (no adjustment)' };
}

/**
 * Team efficiency metrics (using points scored/allowed as proxy)
 * Note: In a production system, these would come from advanced stats APIs
 * like SportsDataIO, Pro Football Reference, or NFL.com stats
 */
export interface TeamEfficiencyMetrics {
  offensiveRanking: number; // 1-32, where 1 is best offense
  defensiveRanking: number; // 1-32, where 1 is best defense (lowest points allowed)
  paceRanking: number; // 1-32, where 1 is fastest pace (estimated from points scored)
}

/**
 * Calculate efficiency metrics from team stats
 * This is a simplified version using points scored/allowed as proxies
 * In production, integrate with advanced stats API for more accurate metrics
 */
export function calculateEfficiencyMetrics(
  avgPointsScored: number,
  avgPointsAllowed: number,
  leagueAvgPointsScored: number = 22.5, // Approximate NFL average
  leagueAvgPointsAllowed: number = 22.5
): TeamEfficiencyMetrics {
  // Use points scored/allowed relative to league average as proxy for efficiency
  // Higher points scored = better offense (lower ranking number = better)
  // Lower points allowed = better defense (lower ranking number = better)
  
  // Estimate offensive ranking (1-32 scale, simplified)
  const offensiveRating = avgPointsScored / leagueAvgPointsScored;
  const offensiveRanking = Math.max(1, Math.min(32, Math.round(33 - (offensiveRating * 16))));
  
  // Estimate defensive ranking (1-32 scale, simplified)
  const defensiveRating = avgPointsAllowed / leagueAvgPointsAllowed;
  const defensiveRanking = Math.max(1, Math.min(32, Math.round(defensiveRating * 16)));
  
  // Estimate pace ranking (using points scored as proxy - more points = faster pace)
  const paceRanking = offensiveRanking; // Simplified: assume faster offense = faster pace
  
  return {
    offensiveRanking,
    defensiveRanking,
    paceRanking,
  };
}

/**
 * Calculate efficiency matchup adjustments
 * Strong offense vs weak defense = higher scoring
 * Weak offense vs strong defense = lower scoring
 */
export function calculateEfficiencyMatchupAdjustment(
  awayMetrics: TeamEfficiencyMetrics,
  homeMetrics: TeamEfficiencyMetrics
): { adjustment: number; reasons: string[] } {
  let adjustment = 0;
  const reasons: string[] = [];
  
  // Offensive/Defensive efficiency matchups
  // Strong offense (low ranking) vs weak defense (high ranking) = more scoring
  const awayOffenseVsHomeDefense = homeMetrics.defensiveRanking - awayMetrics.offensiveRanking;
  if (awayOffenseVsHomeDefense > 10) {
    // Strong offense vs weak defense
    adjustment += 2;
    reasons.push(`Strong away offense vs weak home defense: +2.0`);
  } else if (awayOffenseVsHomeDefense < -10) {
    // Weak offense vs strong defense
    adjustment -= 2;
    reasons.push(`Weak away offense vs strong home defense: -2.0`);
  }
  
  const homeOffenseVsAwayDefense = awayMetrics.defensiveRanking - homeMetrics.offensiveRanking;
  if (homeOffenseVsAwayDefense > 10) {
    // Strong offense vs weak defense
    adjustment += 2;
    reasons.push(`Strong home offense vs weak away defense: +2.0`);
  } else if (homeOffenseVsAwayDefense < -10) {
    // Weak offense vs strong defense
    adjustment -= 2;
    reasons.push(`Weak home offense vs strong away defense: -2.0`);
  }
  
  // Pace of play adjustments
  // Fast-paced teams (low pace ranking) = more scoring opportunities
  const paceDiff = Math.abs(awayMetrics.paceRanking - homeMetrics.paceRanking);
  if (awayMetrics.paceRanking <= 8 && homeMetrics.paceRanking <= 8) {
    // Both teams fast-paced
    adjustment += 1.5;
    reasons.push(`Both teams fast-paced: +1.5`);
  } else if (awayMetrics.paceRanking >= 25 && homeMetrics.paceRanking >= 25) {
    // Both teams slow-paced
    adjustment -= 1;
    reasons.push(`Both teams slow-paced: -1.0`);
  }
  
  return {
    adjustment: Math.round(adjustment * 10) / 10,
    reasons,
  };
}

/**
 * Note on Advanced Stats Integration:
 * 
 * For production use, consider integrating with:
 * 1. SportsDataIO API - Provides team efficiency metrics, pace stats, etc.
 * 2. Pro Football Reference - Scraping or API access for advanced stats
 * 3. NFL.com Stats API - Official NFL statistics
 * 4. ESPN Stats API - May have additional team-level metrics
 * 
 * These would provide more accurate:
 * - Offensive/Defensive DVOA (Defense-adjusted Value Over Average)
 * - Pace of play (plays per game, seconds per play)
 * - Red zone efficiency
 * - Turnover rates
 * - Third down conversion rates
 * - Time of possession
 */

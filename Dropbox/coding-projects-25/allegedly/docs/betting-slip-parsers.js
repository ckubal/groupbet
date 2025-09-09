// betting-slip-parsers.js
// Parsing functions for Bovada and Str8Play betting slips

/**
 * Calculate payout from American odds
 * @param {number} riskAmount - Amount risked
 * @param {string|number} odds - American odds (e.g., "-110", "+150")
 * @returns {number} - Amount to win
 */
function calculatePayout(riskAmount, odds) {
  const numericOdds = typeof odds === 'string' ? parseInt(odds) : odds;
  
  if (numericOdds > 0) {
    // Positive odds: risk $100 to win $odds
    return (riskAmount * numericOdds) / 100;
  } else {
    // Negative odds: risk $|odds| to win $100
    return (riskAmount * 100) / Math.abs(numericOdds);
  }
}

/**
 * Bovada slip parser
 * @param {string} text - Raw text from Bovada confirmation
 * @returns {Object} - Parsed bet data
 */
function parseBovadaSlip(text) {
  const result = {
    platform: 'bovada',
    success: false,
    bets: [],
    totalStake: 0,
    totalPossibleWin: 0,
    rawText: text
  };

  try {
    // Check if it's a successful bet placement
    if (!text.includes('Bets successfully placed')) {
      result.error = 'Not a successful bet confirmation';
      return result;
    }

    // Extract total amounts
    const totalStakeMatch = text.match(/Total Stake:\s*\$?\s*([\d,]+\.?\d*)/);
    const totalWinMatch = text.match(/Possible Winnings:\s*\$?\s*([\d,]+\.?\d*)/);
    
    if (totalStakeMatch) {
      result.totalStake = parseFloat(totalStakeMatch[1].replace(/,/g, ''));
    }
    if (totalWinMatch) {
      result.totalPossibleWin = parseFloat(totalWinMatch[1].replace(/,/g, ''));
    }

    // Check if it's a parlay
    const parlayMatch = text.match(/Parlay\s*\((\d+)\s*Picks?\)/);
    
    if (parlayMatch) {
      // Parse parlay
      const parlay = parseBovadaParlay(text, parlayMatch);
      if (parlay) {
        result.bets.push(parlay);
      }
    } else {
      // Parse individual bets
      const individualBets = parseBovadaIndividualBets(text);
      result.bets.push(...individualBets);
    }

    result.success = result.bets.length > 0;
    return result;

  } catch (error) {
    result.error = `Parsing error: ${error.message}`;
    return result;
  }
}

/**
 * Parse Bovada parlay from text
 */
function parseBovadaParlay(text, parlayMatch) {
  const numPicks = parseInt(parlayMatch[1]);
  
  // Extract parlay details
  const riskMatch = text.match(/Risk:\s*([\d.]+)\s+Win:\s*([\d.]+)/);
  const refMatch = text.match(/Ref\.(\d+)/);
  
  if (!riskMatch) return null;

  const parlay = {
    betType: 'parlay',
    numPicks: numPicks,
    riskAmount: parseFloat(riskMatch[1]),
    toWinAmount: parseFloat(riskMatch[2]),
    platformReference: refMatch ? refMatch[1] : null,
    legs: []
  };

  // Parse individual legs - this is more complex, would need specific patterns
  // For now, return basic parlay info
  return parlay;
}

/**
 * Parse individual Bovada bets
 */
function parseBovadaIndividualBets(text) {
  const bets = [];
  
  // Pattern for spread bets: "> Los Angeles Chargers +3.0 (-115)"
  const spreadPattern = />\s*(.+?)\s+([\+\-]\d+\.?\d*)\s*\(([+-]\d+)\)\s*[\n\r]*Point Spread[\n\r]*Risk:\s*([\d.]+)\s+Win:\s*([\d.]+)[\n\r]*.*?Ref\.(\d+)/g;
  
  let match;
  while ((match = spreadPattern.exec(text)) !== null) {
    bets.push({
      betType: 'single',
      betCategory: 'spread',
      team: match[1].trim(),
      line: match[2],
      odds: match[3],
      riskAmount: parseFloat(match[4]),
      toWinAmount: parseFloat(match[5]),
      platformReference: match[6]
    });
  }

  // Pattern for totals: "> Under 47.5 -115"
  const totalPattern = />\s*(Over|Under)\s+([\d.]+)\s+([+-]\d+)\s*[\n\r]*Total[\n\r]*Risk:\s*([\d.]+)\s+Win:\s*([\d.]+)[\n\r]*.*?Ref\.(\d+)/g;
  
  while ((match = totalPattern.exec(text)) !== null) {
    bets.push({
      betType: 'single',
      betCategory: 'total',
      direction: match[1].toLowerCase(),
      line: match[2],
      odds: match[3],
      riskAmount: parseFloat(match[4]),
      toWinAmount: parseFloat(match[5]),
      platformReference: match[6]
    });
  }

  // Pattern for props: "Under 72.5 Total Receiving Yards - Tyreek Hill (MIA)"
  const propPattern = />\s*(Over|Under)\s+([\d.]+)\s*[\n\r]*(.+?)\s*[\n\r]*Risk:\s*([\d.]+)\s+Win:\s*([\d.]+)[\n\r]*.*?Ref\.(\d+)/g;
  
  while ((match = propPattern.exec(text)) !== null) {
    if (match[3].includes('Receiving Yards') || match[3].includes('Rushing Yards')) {
      bets.push({
        betType: 'single',
        betCategory: 'prop',
        direction: match[1].toLowerCase(),
        line: match[2],
        description: match[3].trim(),
        riskAmount: parseFloat(match[4]),
        toWinAmount: parseFloat(match[5]),
        platformReference: match[6]
      });
    }
  }

  return bets;
}

/**
 * Str8Play slip parser
 * @param {string} text - Raw text from Str8Play confirmation
 * @returns {Object} - Parsed bet data
 */
function parseStr8PlaySlip(text) {
  const result = {
    platform: 'str8play',
    success: false,
    bets: [],
    rawText: text
  };

  try {
    // Pattern for NFL bet: "NFL [473] SAN FRANCISCO 49ERS -2-110"
    const nflPattern = /NFL\s*\[(\d+)\]\s*(.+?)\s+([+-]\d+)([+-]\d+)/;
    const nflMatch = text.match(nflPattern);

    if (!nflMatch) {
      result.error = 'No NFL bet found in text';
      return result;
    }

    // Extract amounts: "220.00 USD/200.00 USD"
    const amountPattern = /([\d.]+)\s*USD\s*\/\s*([\d.]+)\s*USD/;
    const amountMatch = text.match(amountPattern);

    if (!amountMatch) {
      result.error = 'No amount information found';
      return result;
    }

    // Extract ticket number: "TICKET # 326797324"
    const ticketPattern = /TICKET\s*#\s*(\d+)/;
    const ticketMatch = text.match(ticketPattern);

    // Extract date: "SEP 07"
    const datePattern = /([A-Z]{3})\s+(\d{2})/;
    const dateMatch = text.match(datePattern);

    const bet = {
      betType: 'single',
      betCategory: 'spread', // Str8Play format suggests spread
      gameNumber: nflMatch[1],
      team: nflMatch[2].trim(),
      line: nflMatch[3],
      odds: nflMatch[4],
      riskAmount: parseFloat(amountMatch[1]),
      toWinAmount: parseFloat(amountMatch[2]),
      platformReference: ticketMatch ? ticketMatch[1] : null,
      gameDate: dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : null
    };

    result.bets.push(bet);
    result.totalStake = bet.riskAmount;
    result.totalPossibleWin = bet.toWinAmount;
    result.success = true;

    return result;

  } catch (error) {
    result.error = `Parsing error: ${error.message}`;
    return result;
  }
}

/**
 * Auto-detect platform and parse accordingly
 * @param {string} text - Raw betting slip text
 * @returns {Object} - Parsed bet data
 */
function parseAnySlip(text) {
  // Detect platform
  if (text.includes('bovada.lv') || text.includes('Bets successfully placed')) {
    return parseBovadaSlip(text);
  } else if (text.includes('str8play.com') || text.includes('STRAIGHT BET')) {
    return parseStr8PlaySlip(text);
  } else {
    return {
      success: false,
      error: 'Unknown platform - please specify Bovada or Str8Play',
      rawText: text
    };
  }
}

/**
 * Validate parsed bet against current odds (placeholder)
 * @param {Object} bet - Parsed bet object
 * @param {Object} currentOdds - Current odds from API
 * @returns {Object} - Validation result
 */
function validateBet(bet, currentOdds) {
  // This would integrate with your odds API
  // For now, just return basic validation
  return {
    valid: true,
    warnings: [],
    suggestions: []
  };
}

// Export functions
module.exports = {
  calculatePayout,
  parseBovadaSlip,
  parseStr8PlaySlip,
  parseAnySlip,
  validateBet
};

// Example usage:
/*
const text = `
✓ Bets successfully placed

> Los Angeles Chargers          +3.0 (-115)
Point Spread
Risk: 100.00  Win: 86.96       Ref.25092528197395

Total Bets: 1
Total Stake: $ 100.00
Possible Winnings: $ 86.96
`;

const parsed = parseAnySlip(text);
console.log(JSON.stringify(parsed, null, 2));
*/
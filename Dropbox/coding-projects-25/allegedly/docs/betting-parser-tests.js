// betting-parser-tests.js
// Test cases for betting slip parsers

const { 
  calculatePayout, 
  parseBovadaSlip, 
  parseStr8PlaySlip, 
  parseAnySlip 
} = require('./betting-slip-parsers.js');

// Test data based on your actual screenshots
const testCases = {
  bovada: {
    singleSpread: `✓ Bets successfully placed

> Los Angeles Chargers          +3.0 (-115)
Point Spread
Risk: 100.00  Win: 86.96       Ref.25092528197395

Total Bets: 1
Total Stake: $ 100.00
Possible Winnings: $ 86.96`,

    multipleBets: `✓ Bets successfully placed

> Los Angeles Chargers          +3.0 (-115)
Point Spread
Risk: 100.00  Win: 86.96       Ref.25092528197395

> Under 47.5                    -115
Total
Risk: 200.00  Win: 173.91      Ref.25092528197396

Total Bets: 2
Total Stake: $ 300.00
Possible Winnings: $ 260.87`,

    parlay: `✓ Bets successfully placed

PARLAY

Parlay (2 Picks)

Los Angeles Chargers            +3 (-115)
Under 47.5                      -115

Risk: 100.00  Win: 249.53      Ref.25092528117633

Total Bets: 1
Total Stake: $ 100.00
Possible Winnings: $ 249.53`,

    playerProp: `✓ Bets successfully placed

> Under 72.5                    -125
Total Receiving Yards - Tyreek Hill (MIA)

Risk: 100.00  Win: 80.00       Ref.25092546682570

> Over 44.5                     -110
Total Rushing Yards - Breece Hall (NYJ)

Risk: 100.00  Win: 90.91       Ref.25092546682571

Total Bets: 2
Total Stake: $ 200.00
Possible Winnings: $ 170.91`
  },

  str8play: {
    singleBet: `STRAIGHT BET                    SEP 07

NFL [473] SAN FRANCISCO 49ERS -2-110
220.00 USD/200.00 USD          TICKET # 326797324`
  }
};

/**
 * Run all tests
 */
function runTests() {
  console.log('🧪 Running Betting Slip Parser Tests\n');

  // Test payout calculation
  testPayoutCalculation();
  
  // Test Bovada parsing
  testBovadaParsing();
  
  // Test Str8Play parsing
  testStr8PlayParsing();
  
  // Test auto-detection
  testAutoDetection();

  console.log('\n✅ All tests completed!');
}

/**
 * Test payout calculation function
 */
function testPayoutCalculation() {
  console.log('📊 Testing Payout Calculation');
  
  const tests = [
    { risk: 100, odds: '-110', expected: 90.91 },
    { risk: 100, odds: '+150', expected: 150 },
    { risk: 200, odds: '-115', expected: 173.91 },
    { risk: 220, odds: '-110', expected: 200 }
  ];

  tests.forEach(test => {
    const result = calculatePayout(test.risk, test.odds);
    const match = Math.abs(result - test.expected) < 0.1;
    console.log(`  ${match ? '✅' : '❌'} Risk: ${test.risk}, Odds: ${test.odds} → ${result.toFixed(2)} (expected ${test.expected})`);
  });

  console.log('');
}

/**
 * Test Bovada slip parsing
 */
function testBovadaParsing() {
  console.log('🏈 Testing Bovada Parsing');

  // Test single spread bet
  console.log('  Single Spread Bet:');
  const singleResult = parseBovadaSlip(testCases.bovada.singleSpread);
  console.log(`    ${singleResult.success ? '✅' : '❌'} Parse success: ${singleResult.success}`);
  console.log(`    ${singleResult.totalStake === 100 ? '✅' : '❌'} Total stake: ${singleResult.totalStake}`);
  console.log(`    ${singleResult.bets.length === 1 ? '✅' : '❌'} Number of bets: ${singleResult.bets.length}`);

  // Test multiple bets
  console.log('  Multiple Bets:');
  const multipleResult = parseBovadaSlip(testCases.bovada.multipleBets);
  console.log(`    ${multipleResult.success ? '✅' : '❌'} Parse success: ${multipleResult.success}`);
  console.log(`    ${multipleResult.totalStake === 300 ? '✅' : '❌'} Total stake: ${multipleResult.totalStake}`);
  console.log(`    ${multipleResult.bets.length === 2 ? '✅' : '❌'} Number of bets: ${multipleResult.bets.length}`);

  // Test parlay
  console.log('  Parlay:');
  const parlayResult = parseBovadaSlip(testCases.bovada.parlay);
  console.log(`    ${parlayResult.success ? '✅' : '❌'} Parse success: ${parlayResult.success}`);
  console.log(`    ${parlayResult.bets[0]?.betType === 'parlay' ? '✅' : '❌'} Detected as parlay`);

  console.log('');
}

/**
 * Test Str8Play parsing
 */
function testStr8PlayParsing() {
  console.log('🎯 Testing Str8Play Parsing');

  const result = parseStr8PlaySlip(testCases.str8play.singleBet);
  console.log(`  ${result.success ? '✅' : '❌'} Parse success: ${result.success}`);
  console.log(`  ${result.totalStake === 220 ? '✅' : '❌'} Total stake: ${result.totalStake}`);
  console.log(`  ${result.totalPossibleWin === 200 ? '✅' : '❌'} Possible win: ${result.totalPossibleWin}`);
  console.log(`  ${result.bets[0]?.team === 'SAN FRANCISCO 49ERS' ? '✅' : '❌'} Team: ${result.bets[0]?.team}`);
  console.log(`  ${result.bets[0]?.platformReference === '326797324' ? '✅' : '❌'} Ticket: ${result.bets[0]?.platformReference}`);

  console.log('');
}

/**
 * Test auto-detection
 */
function testAutoDetection() {
  console.log('🔍 Testing Auto-Detection');

  // Test Bovada detection
  const bovadaResult = parseAnySlip(testCases.bovada.singleSpread);
  console.log(`  ${bovadaResult.platform === 'bovada' ? '✅' : '❌'} Bovada detection: ${bovadaResult.platform}`);

  // Test Str8Play detection
  const str8playResult = parseAnySlip(testCases.str8play.singleBet);
  console.log(`  ${str8playResult.platform === 'str8play' ? '✅' : '❌'} Str8Play detection: ${str8playResult.platform}`);

  // Test unknown platform
  const unknownResult = parseAnySlip('Some random text that is not a betting slip');
  console.log(`  ${!unknownResult.success ? '✅' : '❌'} Unknown platform handling: ${unknownResult.success ? 'Failed' : 'Correctly rejected'}`);

  console.log('');
}

/**
 * Interactive test function for real data
 */
function testWithRealData(slipText) {
  console.log('📋 Testing with Real Betting Slip Data\n');
  
  const result = parseAnySlip(slipText);
  
  console.log('Platform:', result.platform);
  console.log('Success:', result.success);
  
  if (result.success) {
    console.log('Total Stake: $' + result.totalStake);
    console.log('Possible Win: $' + result.totalPossibleWin);
    console.log('Number of Bets:', result.bets.length);
    
    result.bets.forEach((bet, index) => {
      console.log(`\nBet ${index + 1}:`);
      console.log('  Type:', bet.betType);
      console.log('  Category:', bet.betCategory);
      console.log('  Risk: $' + bet.riskAmount);
      console.log('  To Win: $' + bet.toWinAmount);
      console.log('  Reference:', bet.platformReference);
      
      if (bet.team) console.log('  Team:', bet.team);
      if (bet.line) console.log('  Line:', bet.line);
      if (bet.odds) console.log('  Odds:', bet.odds);
    });
  } else {
    console.log('Error:', result.error);
  }
  
  return result;
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

// Export test functions
module.exports = {
  runTests,
  testWithRealData,
  testCases
};

// Example usage for testing with new slip data:
/*
const newSlipText = `Your betting slip text here...`;
testWithRealData(newSlipText);
*/
'use client';

import React, { useState, useEffect } from 'react';
import { Game, Bet } from '@/types';
import { useUser } from '@/lib/user-context';
import GameCard from '@/components/GameCard';
import BetPopup from '@/components/BetPopup';
import EditBetModal from '@/components/EditBetModal';
import UserSelector from '@/components/UserSelector';
import { format } from 'date-fns';
import { getCurrentNFLWeek } from '@/lib/utils';
import { betService } from '@/lib/firebase-service';
import { calculatePayout, formatOdds } from '@/lib/betting-odds';
import { useRouter, useSearchParams } from 'next/navigation';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface UserBalance {
  won: number;
  lost: number;
  net: number;
}

interface GamesPageProps {
  initialGames: Game[];
  initialWeek?: number;
}

// Utility function to simplify team names
const simplifyTeamName = (text: string): string => {
  const teamReplacements: Record<string, string> = {
    'Green Bay Packers': 'Packers',
    'Kansas City Chiefs': 'Chiefs',
    'New England Patriots': 'Patriots',
    'Los Angeles Rams': 'Rams',
    'Los Angeles Chargers': 'Chargers',
    'New York Giants': 'Giants',
    'New York Jets': 'Jets',
    'San Francisco 49ers': '49ers',
    'Las Vegas Raiders': 'Raiders',
    'Tampa Bay Buccaneers': 'Buccaneers',
    'Buffalo Bills': 'Bills',
    'Miami Dolphins': 'Dolphins',
    'Jacksonville Jaguars': 'Jaguars',
    'Tennessee Titans': 'Titans',
    'Indianapolis Colts': 'Colts',
    'Houston Texans': 'Texans',
    'Denver Broncos': 'Broncos',
    'Pittsburgh Steelers': 'Steelers',
    'Cleveland Browns': 'Browns',
    'Baltimore Ravens': 'Ravens',
    'Cincinnati Bengals': 'Bengals',
    'Minnesota Vikings': 'Vikings',
    'Detroit Lions': 'Lions',
    'Chicago Bears': 'Bears',
    'Philadelphia Eagles': 'Eagles',
    'Dallas Cowboys': 'Cowboys',
    'Washington Commanders': 'Commanders',
    'Seattle Seahawks': 'Seahawks',
    'Arizona Cardinals': 'Cardinals',
    'Atlanta Falcons': 'Falcons',
    'Carolina Panthers': 'Panthers',
    'New Orleans Saints': 'Saints'
  };
  
  let simplified = text;
  Object.entries(teamReplacements).forEach(([fullName, shortName]) => {
    simplified = simplified.replace(new RegExp(fullName, 'g'), shortName);
  });
  
  return simplified;
};

// Utility function to extract last name from player names
const simplifyPlayerName = (text: string): string => {
  // Look for various player name patterns and replace with ONLY last name
  
  // Pattern 1: "FirstName LastName Over/Under X.X stat" or "FirstName LastName: X yards"
  const playerNamePattern1 = /([A-Z][a-z]+)\s+([A-Z][a-z]+)(\s*(?:Over|Under|over|under|\:|number\s+of))/i;
  const match1 = text.match(playerNamePattern1);
  
  if (match1) {
    const firstName = match1[1].trim();
    const lastName = match1[2].trim();
    return text.replace(`${firstName} ${lastName}`, lastName);
  }
  
  // Pattern 2: Handle cases where name might be at start of string
  const playerNamePattern2 = /^([A-Z][a-z]+)\s+([A-Z][a-z]+)(\s+)/;
  const match2 = text.match(playerNamePattern2);
  
  if (match2) {
    const firstName = match2[1].trim();
    const lastName = match2[2].trim();
    return text.replace(`${firstName} ${lastName}`, lastName);
  }
  
  // Pattern 3: Handle "FirstName LastName:" at start (for results like "Jayden Daniels: 200 yards")
  const playerNamePattern3 = /^([A-Z][a-z]+)\s+([A-Z][a-z]+):/;
  const match3 = text.match(playerNamePattern3);
  
  if (match3) {
    const firstName = match3[1].trim();
    const lastName = match3[2].trim();
    return text.replace(`${firstName} ${lastName}:`, `${lastName}:`);
  }
  
  // Pattern 4: Handle any remaining "FirstName LastName" instances anywhere in text
  const playerNamePattern4 = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
  return text.replace(playerNamePattern4, (match, firstName, lastName) => {
    // Common first names that we want to replace (add more as needed)
    const commonFirstNames = ['Jaden', 'Jayden', 'DeAndre', 'Derrick', 'Josh', 'Aaron', 'Tom', 'Patrick', 'Russell', 'Lamar', 'Dak', 'Justin', 'Joe', 'Kyler', 'Tua'];
    if (commonFirstNames.includes(firstName)) {
      return lastName;
    }
    return match; // Leave unchanged if not a recognized first name
  });
};

export default function GamesPage({ initialGames, initialWeek }: GamesPageProps) {
  console.log('🎯 GAMES PAGE RENDERING with', initialGames.length, 'games');
  
  const { currentUser, allUsers } = useUser();
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(initialWeek || getCurrentNFLWeek());
  const [games, setGames] = useState<Game[]>(initialGames);
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [allWeekBets, setAllWeekBets] = useState<Bet[]>([]); // All bets for current week from all users
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false); // Loading indicator for week navigation
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [userBalances, setUserBalances] = useState<Record<string, UserBalance>>({});
  const [showSettlement, setShowSettlement] = useState(false);
  
  // Handle week navigation
  const handleWeekChange = async (week: number) => {
    setIsLoadingWeek(true);
    
    // Clear existing games immediately to prevent showing old week's data
    setGames([]);
    setCurrentWeek(week);
    router.push(`/?week=${week}`);
    
    // Fetch games for the new week
    try {
      console.log(`📅 Fetching games for Week ${week}`);
      const response = await fetch(`/api/games?week=${week}`);
      if (response.ok) {
        const weekGames = await response.json();
        setGames(weekGames);
        console.log(`✅ Loaded ${weekGames.length} games for Week ${week}`);
      } else {
        console.error(`❌ Failed to fetch games for Week ${week}`);
        setGames([]);
      }
    } catch (error) {
      console.error(`❌ Error fetching games for Week ${week}:`, error);
      setGames([]);
    } finally {
      setIsLoadingWeek(false);
    }
  };
  
  // Load additional games for bets that aren't found in current games collection
  const loadMissingBetGames = async (bets: Bet[]) => {
    // Find all unique weeks that have bets
    const weeksWithBets = [...new Set(bets.map(bet => {
      // Extract week number from weekendId or nflWeek field
      if (bet.nflWeek) return bet.nflWeek;
      const weekMatch = bet.weekendId?.match(/week-(\d+)/);
      return weekMatch ? parseInt(weekMatch[1]) : null;
    }).filter(week => week !== null))];
    
    console.log(`🔍 Found bets in weeks: ${weeksWithBets.join(', ')}`);
    
    // Find missing games for each week that has bets
    const weeklyMissingGames = new Map<number, string[]>();
    
    for (const week of weeksWithBets) {
      const weekBets = bets.filter(bet => {
        const betWeek = bet.nflWeek || (bet.weekendId?.match(/week-(\d+)/) ? parseInt(bet.weekendId.match(/week-(\d+)/)![1]) : null);
        return betWeek === week;
      });
      
      const missingGameIds = weekBets
        .filter(bet => !games.find(g => g.id === bet.gameId))
        .map(bet => bet.gameId);
      
      if (missingGameIds.length > 0) {
        weeklyMissingGames.set(week, [...new Set(missingGameIds)]);
      }
    }
    
    if (weeklyMissingGames.size === 0) return;
    
    console.log(`🔍 Loading missing games for weeks: ${Array.from(weeklyMissingGames.keys()).join(', ')}`);
    
    // Load games for each week that has missing games
    const allNewGames: Game[] = [];
    
    for (const [week, missingGameIds] of weeklyMissingGames) {
      try {
        console.log(`📥 Loading ${missingGameIds.length} missing games from Week ${week}`);
        const response = await fetch(`/api/games?week=${week}&force=true`);
        if (response.ok) {
          const weekGames = await response.json();
          console.log(`✅ Loaded ${weekGames.length} games from Week ${week}`);
          allNewGames.push(...weekGames);
        }
      } catch (error) {
        console.error(`❌ Failed to load Week ${week} games:`, error);
      }
    }
    
    if (allNewGames.length > 0) {
      setGames(prevGames => {
        // Merge new games with existing games, avoiding duplicates
        const gameMap = new Map<string, Game>();
        
        // Add existing games
        prevGames.forEach(game => gameMap.set(game.id, game));
        
        // Add new games (will overwrite existing ones with same ID)
        allNewGames.forEach(game => gameMap.set(game.id, game));
        
        return Array.from(gameMap.values());
      });
      
      console.log(`✅ Added ${allNewGames.length} games to collection. Total games: ${games.length + allNewGames.length}`);
    }
  };
  
  // Fetch user bets and settlement data when user changes
  useEffect(() => {
    const fetchUserBets = async () => {
      if (!currentUser) {
        setUserBets([]);
        return;
      }
      
      try {
        setIsLoadingBets(true);
        
        // First, get bets for current week being viewed
        const weekendId = `2025-week-${currentWeek}`;
        const currentWeekBets = await betService.getBetsForUser(currentUser.id, weekendId);
        
        // Also get bets from adjacent weeks (common scenario)
        const allBets: Bet[] = [...currentWeekBets];
        
        // Check a few adjacent weeks for additional bets
        const weeksToCheck = [currentWeek - 1, currentWeek + 1, 2]; // Always check week 2 since it has most bets
        
        for (const week of weeksToCheck) {
          if (week >= 1 && week <= 18 && week !== currentWeek) {
            try {
              const weekendId = `2025-week-${week}`;
              const weekBets = await betService.getBetsForUser(currentUser.id, weekendId);
              allBets.push(...weekBets);
            } catch (error) {
              // Ignore errors for weeks with no bets
              console.log(`No bets found for Week ${week}`);
            }
          }
        }
        
        // Deduplicate user bets by ID to prevent H2H bets from showing up multiple times
        const uniqueUserBets = allBets.reduce((acc: Bet[], current: Bet) => {
          if (!acc.find(bet => bet.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        setUserBets(uniqueUserBets);
        console.log(`✅ Loaded ${uniqueUserBets.length} unique bets for user ${currentUser.name} across all weeks (deduped from ${allBets.length} total)`);
        
        // Load games for any bets that aren't in the current week's game list
        await loadMissingBetGames(allBets);
        
      } catch (error) {
        console.error('❌ Failed to fetch user bets:', error);
        setUserBets([]);
      } finally {
        setIsLoadingBets(false);
      }
    };
    
    const fetchSettlement = async () => {
      try {
        const weekendId = `2025-week-${currentWeek}`;
        const response = await fetch(`/api/weekly-settlement?weekendId=${weekendId}`);
        const data = await response.json();
        
        if (data.success) {
          setSettlements(data.settlements);
          setUserBalances(data.userBalances);
          console.log(`💰 Loaded settlement data: ${data.settlements.length} transactions`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch settlement:', error);
      }
    };

    const fetchAllWeekBets = async () => {
      try {
        const weekendId = `2025-week-${currentWeek}`;
        const allUserIds = ['will', 'D/O', 'rosen', 'charlie', 'pat'];
        const allBets: Bet[] = [];
        
        // Fetch bets for all users for this week
        for (const userId of allUserIds) {
          try {
            const userWeekBets = await betService.getBetsForUser(userId, weekendId);
            allBets.push(...userWeekBets);
          } catch (error) {
            console.log(`No bets found for user ${userId} in Week ${currentWeek}`);
          }
        }
        
        // Deduplicate bets by ID to prevent the same bet showing up multiple times
        const uniqueBets = allBets.reduce((acc: Bet[], current: Bet) => {
          if (!acc.find(bet => bet.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        setAllWeekBets(uniqueBets);
        console.log(`📊 Loaded ${uniqueBets.length} unique bets for Week ${currentWeek} from all users (deduped from ${allBets.length} total)`);
      } catch (error) {
        console.error('❌ Failed to fetch all week bets:', error);
        setAllWeekBets([]);
      }
    };
    
    fetchUserBets();
    fetchSettlement();
    fetchAllWeekBets();
  }, [currentUser, currentWeek]);
  
  // Edit bet handlers
  const handleEditBet = (bet: Bet) => {
    console.log('🎯 Edit bet clicked:', bet);
    setBetToEdit(bet);
    setEditBetModalOpen(true);
  };
  
  const handleSaveBetEdit = async (betId: string, updates: Partial<Bet>) => {
    try {
      const response = await fetch('/api/update-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ betId, updates }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update bet');
      }
      
      // Refresh bets to show the updated data
      const weekendId = `2025-week-${currentWeek}`;
      if (currentUser) {
        // Fetch updated bets for current week and adjacent weeks
        const allUpdatedBets: Bet[] = [];
        
        // Current week
        const currentWeekBets = await betService.getBetsForUser(currentUser.id, weekendId);
        allUpdatedBets.push(...currentWeekBets);
        
        // Adjacent weeks
        const weeksToCheck = [currentWeek - 1, currentWeek + 1, 2];
        for (const week of weeksToCheck) {
          if (week >= 1 && week <= 18 && week !== currentWeek) {
            try {
              const weekEndId = `2025-week-${week}`;
              const weekBets = await betService.getBetsForUser(currentUser.id, weekEndId);
              allUpdatedBets.push(...weekBets);
            } catch (error) {
              console.log(`No bets found for Week ${week}`);
            }
          }
        }
        
        // Deduplicate bets
        const uniqueUpdatedBets = allUpdatedBets.reduce((acc: Bet[], current: Bet) => {
          if (!acc.find(bet => bet.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        setUserBets(uniqueUpdatedBets);
      }
      
      console.log('✅ Bet updated successfully');
    } catch (error) {
      console.error('❌ Error updating bet:', error);
      throw error;
    }
  };
  
  const [selectedBet, setSelectedBet] = useState<{
    game: Game | null;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
  } | null>(null);
  const [isBetPopupOpen, setIsBetPopupOpen] = useState(false);
  
  // Auto-collapse sections where all games are final
  const getDefaultCollapsedSections = () => {
    const collapsed = new Set<string>();
    const gamesByTimeSlot = games.reduce((acc, game) => {
      const slot = game.timeSlot;
      if (!acc[slot]) acc[slot] = [];
      acc[slot].push(game);
      return acc;
    }, {} as Record<string, Game[]>);
    
    // Collapse sections where all games are final
    Object.entries(gamesByTimeSlot).forEach(([slot, slotGames]) => {
      if (slotGames.every(game => game.status === 'final')) {
        collapsed.add(slot);
      }
    });
    
    return collapsed;
  };
  
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(getDefaultCollapsedSections());
  
  // Edit bet modal state
  const [editBetModalOpen, setEditBetModalOpen] = useState(false);
  const [betToEdit, setBetToEdit] = useState<Bet | null>(null);
  
  // Update collapsed sections when games change (e.g., week navigation)
  useEffect(() => {
    setCollapsedSections(getDefaultCollapsedSections());
  }, [games]);

  // Filter games to only show current week in main UI, but keep all games for bet matching
  const currentWeekGames = games.filter(game => {
    // Check if game belongs to current week being viewed
    const gameWeek = game.weekendId?.match(/week-(\d+)/) ? parseInt(game.weekendId.match(/week-(\d+)/)![1]) : null;
    return gameWeek === currentWeek;
  });
  
  // Group games by time slot for display (only current week)
  const gamesByTimeSlot = currentWeekGames.reduce((acc, game) => {
    const slot = game.timeSlot;
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  // Sort games within each time slot by game time
  Object.keys(gamesByTimeSlot).forEach(slot => {
    gamesByTimeSlot[slot].sort((a, b) => 
      new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
    );
  });

  console.log('🎮 UI RENDERING - Games by time slot:', Object.keys(gamesByTimeSlot).map(slot => `${slot}: ${gamesByTimeSlot[slot].length}`));

  const timeSlots = [
    { key: 'thursday', title: 'Thursday Night Football', games: gamesByTimeSlot.thursday || [] },
    { key: 'sunday_early', title: 'Sunday Morning Games (before noon PT)', games: gamesByTimeSlot.sunday_early || [] },
    { key: 'sunday_afternoon', title: 'Sunday Afternoon Games (noon-3pm PT)', games: gamesByTimeSlot.sunday_afternoon || [] },
    { key: 'sunday_night', title: 'Sunday Night Football', games: gamesByTimeSlot.sunday_night || [] },
    { key: 'monday', title: 'Monday Night Football', games: gamesByTimeSlot.monday || [] },
  ];

  const totalGames = currentWeekGames.length;
  const completedGames = currentWeekGames.filter(g => g.status === 'final').length;
  
  return (
    <div className="min-h-screen bg-black text-white font-light">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header - Minimalist */}
        <div className="mb-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-5xl font-light text-white mb-2">
                groupbet
              </h1>
              <div className="text-gray-400 font-mono text-sm tracking-wider">
                nfl week {currentWeek} • {completedGames} of {totalGames} complete
              </div>
            </div>
            
            {/* Week Navigation - Subtle */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => handleWeekChange(Math.max(1, currentWeek - 1))}
                disabled={currentWeek <= 1}
                className={`font-mono text-sm tracking-wide transition-all duration-300 ${
                  currentWeek <= 1 
                    ? 'text-gray-600 cursor-not-allowed' 
                    : 'text-gray-400 hover:text-yellow-300'
                }`}
              >
                [ prev ]
              </button>
              
              <div className="text-yellow-300 font-mono text-lg">
                {currentWeek}
              </div>
              
              <button
                onClick={() => handleWeekChange(Math.min(18, currentWeek + 1))}
                disabled={currentWeek >= 18}
                className={`font-mono text-sm tracking-wide transition-all duration-300 ${
                  currentWeek >= 18 
                    ? 'text-gray-600 cursor-not-allowed' 
                    : 'text-gray-400 hover:text-yellow-300'
                }`}
              >
                [ next ]
              </button>
            </div>
          </div>
          
          {/* User Selection - Elegant */}
          <div className="border-b border-gray-800 pb-8">
            <UserSelector />
          </div>
        </div>

        {currentUser ? (
          <div className="space-y-16">
            {/* Summary and Settlement - Side by Side */}
            <div className="grid grid-cols-2 gap-6">
              {/* Betting Summary - Left Half */}
              {(() => {
                // Filter bets to ONLY current week for summary calculations (exclude cancelled)
                const currentWeekBets = userBets.filter(bet => bet.weekendId === `2025-week-${currentWeek}` && bet.status !== 'cancelled');
                
                let totalStaked = 0; // Total staked on completed bets (wins + losses)
                let totalPayout = 0; // Total payout from wins
                let totalInPlay = 0; // Total staked on active bets
                let wonBets = 0;
                let lostBets = 0;
                let activeBets = 0;
                
                currentWeekBets.forEach(bet => {
                  if (!bet || typeof bet.amountPerPerson !== 'number' || bet.status === 'cancelled') return;
                  
                  // Calculate weighted record based on stake amount
                  // $25 = 0.5 weight, $50 = 1.0 weight, $100 = 2.0 weight
                  let weight;
                  if (bet.amountPerPerson <= 35) {
                    weight = 0.5; // $25-35 range
                  } else if (bet.amountPerPerson <= 75) {
                    weight = 1.0; // $36-75 range  
                  } else {
                    weight = 2.0; // $76+ range
                  }
                  
                  if (bet.status === 'won') {
                    totalStaked += bet.amountPerPerson; // Count stakes for completed wins
                    if (bet.amountPerPerson && bet.odds) {
                      const { totalPayout: betPayout } = calculatePayout(bet.amountPerPerson, bet.odds);
                      totalPayout += betPayout;
                    }
                    wonBets += weight;
                  } else if (bet.status === 'lost') {
                    totalStaked += bet.amountPerPerson; // Count stakes for completed losses
                    lostBets += weight;
                  } else {
                    totalInPlay += bet.amountPerPerson; // Count stakes for active bets separately
                    activeBets += weight;
                  }
                });
                
                const netProfit = totalPayout - totalStaked;
                
                // Show empty state if no bets for current week
                if (currentWeekBets.length === 0) {
                  return (
                    <div className="bg-gray-900/20 border border-gray-800/50 rounded-3xl p-8">
                      <h2 className="text-2xl font-light mb-6 text-white">
                        summary
                      </h2>
                      <div className="text-gray-400 text-center py-8">
                        no bets placed this week
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="bg-gray-900/20 border border-gray-800/50 rounded-3xl p-8">
                    <h2 className="text-2xl font-light mb-6 text-white">
                      summary
                    </h2>
                    
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <div className="text-gray-400 text-sm font-mono mb-1">in play</div>
                        <div className="text-yellow-400 text-2xl font-mono">
                          ${totalInPlay.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm font-mono mb-1">profit</div>
                        <div className={`text-2xl font-mono ${
                          netProfit > 0 ? 'text-green-400' : 
                          netProfit < 0 ? 'text-red-400' : 'text-gray-300'
                        }`}>
  {netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm font-mono mb-1">record</div>
                        <div className="text-white text-2xl font-mono">
                          {wonBets % 1 === 0 ? wonBets.toFixed(0) : wonBets.toFixed(1)}W-{lostBets % 1 === 0 ? lostBets.toFixed(0) : lostBets.toFixed(1)}L
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()} 

              {/* Weekly Settlement - Right Half */}
              {settlements.length > 0 && (
                <div className="bg-gray-900/20 border border-gray-800/50 rounded-3xl p-8">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-light text-white mb-1">
                        settlement
                      </h2>
                      
                      {/* Team Performance - Above transactions, no plus sign */}
                      {(() => {
                        // Calculate total team profit/loss without double-counting
                        let teamTotal = 0;
                        
                        // Process each UNIQUE bet only once (avoid counting same bet multiple times)
                        const uniqueBets = new Map<string, Bet>();
                        allWeekBets.forEach(bet => {
                          if (bet?.id) {
                            uniqueBets.set(bet.id, bet);
                          }
                        });
                        
                        // Calculate total P&L from unique bets
                        uniqueBets.forEach(bet => {
                          if (!bet) return;
                          
                          if (bet.status === 'won') {
                            // For wins: total participants split the total pot
                            if (bet.amountPerPerson && bet.odds && bet.participants) {
                              const { profit } = calculatePayout(bet.amountPerPerson, bet.odds);
                              // Each participant gets profit, so total team profit = profit × participants
                              teamTotal += profit * bet.participants.length;
                            }
                          } else if (bet.status === 'lost') {
                            // For losses: each participant loses their stake
                            if (bet.amountPerPerson && bet.participants) {
                              teamTotal -= bet.amountPerPerson * bet.participants.length;
                            }
                          }
                        });
                        
                        console.log(`🎯 Team total: $${teamTotal.toFixed(2)} from ${uniqueBets.size} unique bets`);
                        console.log(`📊 Breakdown: ${Array.from(uniqueBets.values()).map(b => `${b?.selection || 'Unknown'}: ${b?.status || 'Unknown'}`).join(', ')}`);
                        
                        return (
                          <div className="text-white font-light text-sm mb-2">
                            <span className="text-gray-400">team is </span>
                            <span className={`font-light ${teamTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {teamTotal >= 0 ? 'up' : 'down'}
                            </span>
                            <span className="text-gray-400"> </span>
                            <span className={`font-mono ${teamTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${Math.abs(teamTotal).toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <button
                      onClick={() => setShowSettlement(!showSettlement)}
                      className="text-gray-400 hover:text-yellow-300 transition-all duration-300 text-sm font-mono tracking-wide"
                    >
                      {showSettlement ? '[ hide ]' : '[ show ]'}
                    </button>
                  </div>
                
                {showSettlement && (
                  <div className="space-y-6">
                    {settlements.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 font-light text-lg">
                        everyone is even
                      </div>
                    ) : (
                      settlements.map((settlement, index) => (
                        <div key={index} className="group">
                          <div className="py-3 border-b border-gray-800/30 hover:border-yellow-300/30 transition-all duration-300">
                            <div className="text-lg">
                              <span className="text-yellow-300 font-medium">{settlement.from} </span>
                              <span className="text-gray-400 font-light">owes </span>
                              <span className="text-yellow-300 font-medium">{settlement.to} </span>
                              <span className="text-white font-mono ml-4 group-hover:text-yellow-300 transition-colors duration-300">
                                ${settlement.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            </div> {/* Close grid for side-by-side */}

            {/* User Bets - Minimal Grid */}
            {(() => {
              // Filter bets to ONLY current week for display (exclude cancelled)
              const currentWeekBets = userBets.filter(bet => bet.weekendId === `2025-week-${currentWeek}`);
              
              if (currentWeekBets.length === 0) {
                return null;
              }
              
              // Sort bets by game time (chronological order)
              const sortedBets = currentWeekBets.sort((a, b) => {
                const gameA = games.find(g => g.id === a.gameId);
                const gameB = games.find(g => g.id === b.gameId);
                
                // If we can't find the games, put them at the end
                if (!gameA && !gameB) return 0;
                if (!gameA) return 1;
                if (!gameB) return -1;
                
                // Sort by game time
                return new Date(gameA.gameTime).getTime() - new Date(gameB.gameTime).getTime();
              });
              
              return (
                <div className="bg-gray-900/20 border border-gray-800/50 rounded-3xl p-8">
                  <h2 className="text-2xl font-light text-white mb-8">
                    {currentUser?.name || 'your'} bets • {sortedBets.length}
                  </h2>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {sortedBets.map(bet => {
                    if (!bet) return null;
                    const game = games.find(g => g.id === bet?.gameId);
                    
                    // Handle head-to-head vs group bets differently
                    const isHeadToHead = bet?.bettingMode === 'head_to_head';
                    let userSide: 'A' | 'B' | null = null;
                    let userSelection = bet?.selection;
                    
                    if (isHeadToHead && currentUser) {
                      if (bet?.sideA?.participants.includes(currentUser.id)) {
                        userSide = 'A';
                        userSelection = bet?.sideA?.selection;
                      } else if (bet?.sideB?.participants.includes(currentUser.id)) {
                        userSide = 'B';
                        userSelection = bet?.sideB?.selection;
                      }
                    }
                    
                    // Calculate win/loss amount and payout using actual betting odds
                    let betResult = '';
                    let resultColor = 'text-gray-400';
                    let resultIcon = '';
                    let backgroundColor = '';
                    let borderColor = '';
                    let userWon = false;
                    
                    if (isHeadToHead && bet?.winningSide && userSide) {
                      // Head-to-head: check if user's side won
                      userWon = bet.winningSide === userSide;
                      if (userWon) {
                        betResult = `+$${bet?.amountPerPerson?.toFixed(0) || '0'}`;
                        resultColor = 'text-green-900';
                        resultIcon = '✓';
                        backgroundColor = '#bbf7d0';
                        borderColor = '#22c55e';
                      } else {
                        betResult = `-$${bet?.amountPerPerson?.toFixed(0) || '0'}`;
                        resultColor = 'text-red-900';
                        resultIcon = '✗';
                        backgroundColor = '#fecaca';
                        borderColor = '#ef4444';
                      }
                    } else if (!isHeadToHead) {
                      // Group bet: use existing logic
                      if (bet?.status === 'won') {
                        if (bet?.amountPerPerson && bet?.odds) {
                          const { profit } = calculatePayout(bet.amountPerPerson, bet.odds);
                          betResult = `+$${profit.toFixed(0)}`;
                        } else {
                          betResult = '+$0';
                        }
                        resultColor = 'text-green-900';
                        resultIcon = '✓';
                        backgroundColor = '#bbf7d0';
                        borderColor = '#22c55e';
                      } else if (bet?.status === 'lost') {
                        betResult = `-$${bet?.amountPerPerson ? bet.amountPerPerson.toFixed(0) : '0'}`;
                        resultColor = 'text-red-900';
                        resultIcon = '✗';
                        backgroundColor = '#fecaca';
                        borderColor = '#ef4444';
                      } else {
                        betResult = 'pending';
                        resultColor = 'text-yellow-300';
                        resultIcon = '·';
                        backgroundColor = 'rgba(0, 0, 0, 0.3)';
                        borderColor = 'rgba(75, 85, 99, 0.5)';
                      }
                    } else {
                      // Handle individual head-to-head bets or other states
                      if (bet?.status === 'won') {
                        if (bet?.amountPerPerson && bet?.odds) {
                          const { profit } = calculatePayout(bet.amountPerPerson, bet.odds);
                          betResult = `+$${profit.toFixed(0)}`;
                        } else {
                          betResult = `+$${bet?.amountPerPerson?.toFixed(0) || '0'}`;
                        }
                        resultColor = 'text-green-900';
                        resultIcon = '✓';
                        backgroundColor = '#bbf7d0';
                        borderColor = '#22c55e';
                      } else if (bet?.status === 'lost') {
                        betResult = `-$${bet?.amountPerPerson ? bet.amountPerPerson.toFixed(0) : '0'}`;
                        resultColor = 'text-red-900';
                        resultIcon = '✗';
                        backgroundColor = '#fecaca';
                        borderColor = '#ef4444';
                      } else {
                        // Active or unknown states
                        betResult = 'pending';
                        resultColor = 'text-yellow-300';
                        resultIcon = '·';
                        backgroundColor = 'rgba(0, 0, 0, 0.3)';
                        borderColor = 'rgba(75, 85, 99, 0.5)';
                      }
                    }
                    
                    return (
                      <div 
                        key={bet?.id || Math.random()} 
                        style={{ 
                          width: 'calc(23.333% - 8px)', 
                          minWidth: '140px',
                          maxWidth: 'calc(23.333% - 8px)',
                          minHeight: '120px',
                          backgroundColor: backgroundColor,
                          borderColor: borderColor,
                          cursor: 'pointer'
                        }}
                        className="border rounded-xl p-3 transition-all duration-300 hover:border-yellow-300/30"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🖱️ Bet card clicked!');
                          console.log('📦 Bet object:', bet);
                          console.log('📍 Current bet ID:', bet?.id);
                          if (bet) {
                            handleEditBet(bet);
                          } else {
                            console.log('❌ Bet is undefined');
                          }
                        }}
                      >
                        <div className="mb-1">
                          <div className="text-white font-light text-sm mb-1 truncate">
                            {game ? `${game.awayTeam.split(' ').pop()} @ ${game.homeTeam.split(' ').pop()}` : 'Game Not Found'}
                          </div>
                          <div className="text-sm text-gray-400 font-mono truncate">
                            {isHeadToHead ? (
                              userSide === 'A' 
                                ? `H2H vs ${bet?.sideB?.participants.map(id => allUsers.find(u => u.id === id)?.name || id).join(', ')}`
                                : userSide === 'B'
                                ? `H2H vs ${bet?.sideA?.participants.map(id => allUsers.find(u => u.id === id)?.name || id).join(', ')}`
                                : 'H2H'
                            ) : (bet?.placedBy || 'Unknown')}
                          </div>
                        </div>
                        
                        <div className="text-gray-300 text-sm mb-1 font-mono">
                          <span className="truncate block">
                            ${bet?.amountPerPerson?.toFixed(0) || '0'} on {simplifyPlayerName(simplifyTeamName(userSelection || 'Unknown'))} ({bet?.odds ? formatOdds(bet.odds) : '(-110)'})
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-end">
                          <div className={`${resultColor} text-sm font-mono flex items-center`}>
                            <span className="mr-1 text-sm">{resultIcon}</span>
                            <span className="truncate">{betResult}</span>
                          </div>
                        </div>
                        
                        {game && game.status === 'final' && (
                          <div className="text-yellow-300 text-sm mt-1 font-mono truncate">
                            {bet?.betType === 'player_prop' && bet?.result ? 
                              simplifyPlayerName(bet.result) : 
                              `${game.awayTeam.split(' ').pop()} ${game.awayScore}-${game.homeTeam.split(' ').pop()} ${game.homeScore}`
                            }
                          </div>
                        )}
                        
                        {game && game.status === 'live' && (
                          <div className="text-green-400 text-sm mt-1 font-mono truncate">
                            <div className="flex items-center justify-between">
                              <span>
                                Q{game.quarter || '?'} {game.timeRemaining || 'Live'}
                              </span>
                              {game.possession && (
                                <span className="flex items-center">
                                  🏈 {game.possession.split(' ').pop()}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              {game.awayTeam.split(' ').pop()} {game.awayScore || 0}-{game.homeTeam.split(' ').pop()} {game.homeScore || 0}
                            </div>
                          </div>
                        )}
                        
                        {!game && (
                          <div className="text-orange-400 text-sm mt-2 font-mono">
                            missing data
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Loading Indicator for Week Navigation */}
            {isLoadingWeek && (
              <div className="bg-gray-900/20 border border-gray-800/50 rounded-3xl p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-300 mx-auto mb-4"></div>
                <div className="text-gray-400 font-mono">
                  loading week {currentWeek} games...
                </div>
              </div>
            )}

            {/* Games by Time Slot - Minimalist Sections */}
            {!isLoadingWeek && timeSlots.map(timeSlot => {
              if (timeSlot.games.length === 0) return null;
              
              const isCollapsed = collapsedSections.has(timeSlot.key);
              
              return (
                <div key={timeSlot.key} className="bg-gray-900/20 border border-gray-800/50 rounded-3xl overflow-hidden">
                  <button
                    onClick={() => {
                      const newCollapsed = new Set(collapsedSections);
                      if (isCollapsed) {
                        newCollapsed.delete(timeSlot.key);
                      } else {
                        newCollapsed.add(timeSlot.key);
                      }
                      setCollapsedSections(newCollapsed);
                    }}
                    className="w-full px-8 py-6 text-left hover:bg-gray-800/20 transition-all duration-300 flex justify-between items-center"
                  >
                    <div>
                      <h3 className="text-xl font-light text-white mb-1">
                        {timeSlot.title.toLowerCase()}
                      </h3>
                      <div className="text-sm text-gray-400 font-mono">
                        {timeSlot.games.length} game{timeSlot.games.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className="text-gray-400 font-mono transition-transform duration-300">
                      {isCollapsed ? '[ + ]' : '[ - ]'}
                    </span>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="px-8 pb-8">
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {timeSlot.games.map(game => (
                          <GameCard
                            key={game.id}
                            game={game}
                            userBets={userBets}
                            onBetClick={(game, betType, selection) => {
                              setSelectedBet({ game, betType, selection });
                              setIsBetPopupOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {totalGames === 0 && (
              <div className="text-center py-24">
                <p className="text-gray-400 text-xl font-light">no games found for this week</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-400 text-xl font-light">select a user to view games and place bets</p>
          </div>
        )}
      </div>

      {/* Bet Popup */}
      <BetPopup
        isOpen={isBetPopupOpen}
        onClose={() => setIsBetPopupOpen(false)}
        game={selectedBet?.game || null}
        betType={selectedBet?.betType || 'spread'}
        selection={selectedBet?.selection || ''}
        onPlaceBet={(betData) => {
          betService.createBet(betData).then(() => {
            setIsBetPopupOpen(false);
            // Refresh user bets when a new bet is placed (with deduplication)
            if (currentUser) {
              const weekendId = `2025-week-${currentWeek}`;
              const allUpdatedBets: Bet[] = [];
              
              // Fetch bets from multiple weeks and deduplicate
              Promise.all([
                betService.getBetsForUser(currentUser.id, weekendId),
                betService.getBetsForUser(currentUser.id, `2025-week-2`) // Always check week 2
              ]).then(([currentWeekBets, week2Bets]) => {
                allUpdatedBets.push(...currentWeekBets, ...week2Bets);
                
                // Deduplicate bets
                const uniqueUpdatedBets = allUpdatedBets.reduce((acc: Bet[], current: Bet) => {
                  if (!acc.find(bet => bet.id === current.id)) {
                    acc.push(current);
                  }
                  return acc;
                }, []);
                
                setUserBets(uniqueUpdatedBets);
              });
            }
          }).catch(error => {
            console.error('❌ Failed to place bet:', error);
          });
        }}
      />
      
      {/* Edit Bet Modal */}
      <EditBetModal
        bet={betToEdit}
        isOpen={editBetModalOpen}
        onClose={() => {
          console.log('🚪 Closing edit modal');
          setEditBetModalOpen(false);
          setBetToEdit(null);
        }}
        onSave={handleSaveBetEdit}
      />
    </div>
  );
}
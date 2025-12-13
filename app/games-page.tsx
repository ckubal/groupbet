'use client';

import React, { useState, useEffect } from 'react';
import { Game, Bet } from '@/types';
import { useUser } from '@/lib/user-context';
import { useGroup } from '@/lib/group-context';
import GameCard from '@/components/GameCard';
import BetPopup from '@/components/BetPopup';
import EditBetModal from '@/components/EditBetModal';
import ParlayBuilder from '@/components/ParlayBuilder';
import ParlayPanel, { ParlaySelection } from '@/components/ParlayPanel';
import UserSelector from '@/components/UserSelector';
import ResearchPanel from '@/components/ResearchPanel';
import ExperimentalPanel from '@/components/ExperimentalPanel';
import ImageBetUpload from '@/components/ImageBetUpload';
import { format } from 'date-fns';
import { getCurrentNFLWeek } from '@/lib/utils';
import { betService } from '@/lib/firebase-service';
import { calculatePayout, formatOdds } from '@/lib/betting-odds';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTimeSlot } from '@/lib/time-slot-utils';

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

// Client-side function to calculate correct time slot based on actual game time
// Uses shared utility for consistency
const calculateCorrectTimeSlot = (gameTime: Date | string): string => {
  return getTimeSlot(gameTime, false); // Disable logging on client side
};

export default function GamesPage({ initialGames, initialWeek }: GamesPageProps) {
  console.log('🎯 GAMES PAGE RENDERING with', initialGames.length, 'games');
  console.log('🎯 Initial week:', initialWeek);
  if (initialGames.length > 0) {
    console.log('🎯 Sample game:', {
      id: initialGames[0].id,
      teams: `${initialGames[0].awayTeam} @ ${initialGames[0].homeTeam}`,
      weekendId: initialGames[0].weekendId,
      timeSlot: initialGames[0].timeSlot
    });
  } else {
    console.warn('⚠️ WARNING: No initial games provided to GamesPage component');
  }
  
  const { currentUser, allUsers } = useUser();
  const { clearGroupSession, groupSession } = useGroup();
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
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  
  // Helper function to fetch bets via API (avoids Firebase permission errors)
  const fetchUserBetsViaAPI = async (userId: string, weekendId?: string): Promise<Bet[]> => {
    try {
      const url = `/api/get-user-bets?userId=${encodeURIComponent(userId)}${weekendId ? `&weekendId=${encodeURIComponent(weekendId)}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch bets: ${response.statusText}`);
      }
      const data = await response.json();
      return data.bets.map((bet: any) => ({
        ...bet,
        createdAt: bet.createdAt ? new Date(bet.createdAt) : new Date(),
        resolvedAt: bet.resolvedAt ? new Date(bet.resolvedAt) : undefined
      })) as Bet[];
    } catch (error) {
      console.error(`❌ Error fetching bets for user ${userId}:`, error);
      return [];
    }
  };
  
  // Parlay builder state
  const [isParlayMode, setIsParlayMode] = useState(false);
  const [parlaySelections, setParlaySelections] = useState<ParlaySelection[]>([]);
  
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
      const response = await fetch(`/api/games?week=${week}&force=true`);
      if (response.ok) {
        const weekGames = await response.json();
        setGames(weekGames);
        console.log(`✅ Loaded ${weekGames.length} games for Week ${week}`);
        
        // Only resolve bets for the CURRENT NFL week, not past weeks
        const currentNFLWeek = getCurrentNFLWeek();
        if (week === currentNFLWeek) {
          const completedGames = weekGames.filter((g: Game) => g.status === 'final');
          if (completedGames.length > 0) {
            console.log(`🎯 Resolving bets for ${completedGames.length} completed games in current Week ${week}...`);
            try {
              const resolveResponse = await fetch('/api/resolve-bets', { method: 'POST' });
              if (resolveResponse.ok) {
                const resolveResult = await resolveResponse.json();
                console.log(`✅ Resolved ${resolveResult.resolvedCount} bets`);
                
                // Force refresh ALL bet data to sync with backend
                console.log('🔄 Force refreshing all bet data after resolution...');
                
                // Reload user bets for current week
                if (currentUser) {
                  const weekendId = `2025-week-${currentNFLWeek}`;
                  const freshUserBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
                  setUserBets(freshUserBets);
                  console.log(`✅ Refreshed ${freshUserBets.length} user bets for Week ${currentNFLWeek}`);
                }
                
                // Reload all week bets from all users
                const weekendId = `2025-week-${currentNFLWeek}`;
                const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
                const allFreshBets: Bet[] = [];
                
                for (const userId of allUserIds) {
                  try {
                    const userWeekBets = await fetchUserBetsViaAPI(userId, weekendId);
                    allFreshBets.push(...userWeekBets);
                  } catch (error) {
                    // Ignore
                  }
                }
                
                // Deduplicate and set
                const uniqueBets = allFreshBets.reduce((acc: Bet[], current: Bet) => {
                  if (!acc.find(bet => bet.id === current.id)) {
                    acc.push(current);
                  }
                  return acc;
                }, []);
                
                setAllWeekBets(uniqueBets);
                console.log(`✅ Refreshed ${uniqueBets.length} total week bets`);
                
                // Force a re-render by updating a timestamp
                setLastUpdated(Date.now());
              }
            } catch (error) {
              console.error('❌ Failed to auto-resolve bets:', error);
            }
          }
        }
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
    // Skip loading past week games to avoid data overload
    console.log('⚠️ Skipping loading of past week games to optimize performance');
    return;
    
    // DISABLED: Find all unique weeks that have bets
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
  
  // Auto-update to current NFL week if it has changed (check on mount and periodically)
  useEffect(() => {
    const checkAndUpdateWeek = () => {
      const actualCurrentWeek = getCurrentNFLWeek();
      // Get current week from state (using functional update to avoid stale closure)
      setCurrentWeek(currentStateWeek => {
        if (actualCurrentWeek !== currentStateWeek) {
          console.log(`📅 NFL week mismatch: Displaying Week ${currentStateWeek}, but current NFL week is Week ${actualCurrentWeek}`);
          // Only auto-update if we're viewing a past week (not if user manually selected a future week)
          // Also check if URL has no week param (meaning we should show current week)
          const urlParams = new URLSearchParams(window.location.search);
          const urlWeek = urlParams.get('week');
          
          if (!urlWeek && actualCurrentWeek !== currentStateWeek) {
            console.log(`📅 Auto-updating to current NFL Week ${actualCurrentWeek} (no week in URL)`);
            handleWeekChange(actualCurrentWeek);
          } else if (urlWeek && parseInt(urlWeek) < actualCurrentWeek && currentStateWeek < actualCurrentWeek) {
            console.log(`📅 Auto-updating from past Week ${currentStateWeek} to current Week ${actualCurrentWeek}`);
            handleWeekChange(actualCurrentWeek);
          }
        }
        return currentStateWeek; // Return unchanged to avoid triggering re-render
      });
    };
    
    // Check immediately on mount
    checkAndUpdateWeek();
    
    // Also check periodically (every hour) in case week advances while page is open
    const interval = setInterval(checkAndUpdateWeek, 60 * 60 * 1000); // 1 hour
    
    return () => clearInterval(interval);
  }, []); // Only run on mount, then use interval

  // Fetch user bets and settlement data when user changes
  useEffect(() => {
    const fetchUserBets = async () => {
      if (!currentUser) {
        setUserBets([]);
        return;
      }

      try {
        setIsLoadingBets(true);

        // ONLY get bets for current week being viewed - no past or future weeks
        const weekendId = `2025-week-${currentWeek}`;
        console.log(`📊 Loading bets ONLY for current Week ${currentWeek}`);
        
        // Use API route instead of direct Firebase access to avoid permission errors
        const response = await fetch(`/api/get-user-bets?userId=${encodeURIComponent(currentUser.id)}&weekendId=${encodeURIComponent(weekendId)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch bets: ${response.statusText}`);
        }
        const data = await response.json();
        const currentWeekBets: Bet[] = data.bets.map((bet: any) => ({
          ...bet,
          createdAt: bet.createdAt ? new Date(bet.createdAt) : new Date(),
          resolvedAt: bet.resolvedAt ? new Date(bet.resolvedAt) : undefined
        }));
        
        // Use only current week bets
        const allBets: Bet[] = [...currentWeekBets];
        
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
        const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
        const allBets: Bet[] = [];
        
        // Fetch bets for all users for this week
        for (const userId of allUserIds) {
          try {
            const userWeekBets = await fetchUserBetsViaAPI(userId, weekendId);
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
        const currentWeekBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
        allUpdatedBets.push(...currentWeekBets);
        
        // Adjacent weeks
        const weeksToCheck = [currentWeek - 1, currentWeek + 1, 2];
        for (const week of weeksToCheck) {
          if (week >= 1 && week <= 18 && week !== currentWeek) {
            try {
              const weekEndId = `2025-week-${week}`;
              const weekBets = await fetchUserBetsViaAPI(currentUser.id, weekEndId);
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

  const handleDeleteBet = async (betId: string) => {
    try {
      console.log(`🗑️ Deleting bet: ${betId}`);
      
      const response = await fetch(`/api/delete-bet?betId=${betId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete bet');
      }
      
      const result = await response.json();
      console.log('✅ Bet deleted successfully:', result);
      
      // Refresh bets to remove the deleted bet from the UI
      const weekendId = `2025-week-${currentWeek}`;
      if (currentUser) {
        // Fetch updated bets for current week and adjacent weeks
        const allUpdatedBets: Bet[] = [];
        
        // Current week
        const currentWeekBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
        allUpdatedBets.push(...currentWeekBets);
        
        // Adjacent weeks
        const weeksToCheck = [currentWeek - 1, currentWeek + 1, 2];
        for (const week of weeksToCheck) {
          if (week >= 1 && week <= 18 && week !== currentWeek) {
            try {
              const weekEndId = `2025-week-${week}`;
              const weekBets = await fetchUserBetsViaAPI(currentUser.id, weekEndId);
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
      
    } catch (error) {
      console.error('❌ Error deleting bet:', error);
      throw error;
    }
  };
  
  // Parlay handlers
  const handleToggleParlayMode = () => {
    setIsParlayMode(!isParlayMode);
    if (isParlayMode) {
      // Clear selections when exiting parlay mode
      setParlaySelections([]);
    }
  };
  
  const handleAddToParlaySelection = (selection: ParlaySelection) => {
    console.log('🎯 handleAddToParlaySelection called with:', selection);
    console.log('🎯 Selection ID:', selection.id);
    setParlaySelections(prev => {
      console.log('🎯 Current parlay selections:', prev.map(s => ({ id: s.id, selection: s.selection })));
      // Check if this exact selection already exists
      const exists = prev.find(s => s.id === selection.id);
      if (exists) {
        console.log('⚠️ Selection already exists, not adding duplicate. Existing:', exists.id);
        return prev; // Don't add duplicates
      }
      
      const newSelections = [...prev, selection];
      console.log('✅ Updated parlay selections:', newSelections.map(s => ({ id: s.id, selection: s.selection })));
      return newSelections;
    });
  };
  
  const handleRemoveParlaySelection = (selectionId: string) => {
    setParlaySelections(prev => prev.filter(s => s.id !== selectionId));
  };
  
  const handleClearParlaySelections = () => {
    setParlaySelections([]);
  };
  
  const handlePlaceParlay = async (parlayData: any) => {
    try {
      console.log('🎰 Placing parlay bet - received data:', parlayData);
      
      // Validate required fields
      if (!parlayData.weekendId || !parlayData.placedBy || !parlayData.participants || parlayData.participants.length === 0) {
        console.error('❌ Missing required parlay data:', {
          weekendId: parlayData.weekendId,
          placedBy: parlayData.placedBy,
          participants: parlayData.participants
        });
        return;
      }

      // Clean and validate parlay legs
      const cleanedParlayLegs = parlayData.parlayLegs.map((leg: any, index: number) => {
        const cleanedLeg: any = {
          betId: leg.betId || `${leg.gameId}-${leg.betType}-${index}`,
          gameId: leg.gameId,
          betType: leg.betType,
          selection: leg.selection,
          odds: leg.odds || -110
        };
        
        // Only add line if it exists and is valid
        if (leg.line !== undefined && leg.line !== null && !isNaN(leg.line)) {
          cleanedLeg.line = leg.line;
        }
        
        return cleanedLeg;
      });

      const betPayload = {
        weekendId: parlayData.weekendId,
        gameId: 'parlay', // Special ID for parlays
        placedBy: parlayData.placedBy,
        participants: parlayData.participants,
        betType: 'parlay' as const,
        selection: `${parlayData.parlayLegs.length}-leg parlay`,
        odds: parlayData.parlayOdds || -110,
        parlayLegs: cleanedParlayLegs,
        parlayOdds: parlayData.parlayOdds || -110,
        bettingMode: 'group' as const,
        totalAmount: parlayData.totalAmount || 0,
        amountPerPerson: parlayData.amountPerPerson || 0
      };

      console.log('🎰 Creating parlay bet with cleaned data:', betPayload);
      
      // Create the parlay bet using the bet service
      const betId = await betService.createBet(betPayload);
      
      console.log('✅ Parlay bet created with ID:', betId);
      
      // Clear parlay state
      setParlaySelections([]);
      setIsParlayMode(false);
      
      // Refresh bets
      if (currentUser) {
        const weekendId = `2025-week-${currentWeek}`;
        const freshUserBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
        setUserBets(freshUserBets);
      }
      
    } catch (error) {
      console.error('❌ Error placing parlay bet:', error);
      throw error;
    }
  };
  
  const [selectedBet, setSelectedBet] = useState<{
    game: Game | null;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
  } | null>(null);
  const [isBetPopupOpen, setIsBetPopupOpen] = useState(false);
  const [isParlayBuilderOpen, setIsParlayBuilderOpen] = useState(false);
  
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
  
  // Tab state for Bets vs Research
  const [activeTab, setActiveTab] = useState<'bets' | 'research' | 'experimental'>('research');
  
  // Update collapsed sections when games change (e.g., week navigation)
  useEffect(() => {
    setCollapsedSections(getDefaultCollapsedSections());
  }, [games]);

  // Filter games to only show current week in main UI, but keep all games for bet matching
  const currentWeekGames = games.filter(game => {
    // Check if game belongs to current week being viewed
    const gameWeek = game.weekendId?.match(/week-(\d+)/) ? parseInt(game.weekendId.match(/week-(\d+)/)![1]) : null;
    const matches = gameWeek === currentWeek;
    if (!matches && game.weekendId) {
      console.log(`🔍 Game filtered out: ${game.awayTeam} @ ${game.homeTeam} (weekendId: ${game.weekendId}, expected: 2025-week-${currentWeek})`);
    }
    return matches;
  });
  
  console.log(`📊 Filtered games: ${games.length} total → ${currentWeekGames.length} for Week ${currentWeek}`);
  
  // Group games by time slot for display (only current week)
  // Use client-side calculation to override incorrect cached timeSlot values
  const gamesByTimeSlot = currentWeekGames.reduce((acc, game) => {
    // Calculate correct timeSlot based on actual game time
    const correctSlot = calculateCorrectTimeSlot(game.gameTime);
    
    // Debug log when cached slot differs from calculated slot
    if (game.timeSlot !== correctSlot) {
      console.log(`🔄 Correcting ${game.awayTeam} @ ${game.homeTeam}: cached="${game.timeSlot}" → calculated="${correctSlot}"`);
    }
    
    // Use the correctly calculated slot
    const slot = correctSlot;
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
  
  // Handle bet placement from research
  const handleResearchBetPlacement = (analysis: any) => {
    // Check if user has a group session before allowing bet placement
    if (!groupSession) {
      alert('Please join or start a group to place bets');
      return;
    }
    
    // Find the matching game
    const matchingGame = games.find(g => 
      g.awayTeam === analysis.awayTeam && g.homeTeam === analysis.homeTeam
    );
    
    if (matchingGame) {
      setSelectedBet({
        game: matchingGame,
        betType: 'over_under',
        selection: analysis.recommendation === 'over' ? 'over' : 'under',
      });
      setIsBetPopupOpen(true);
    }
  };
  
  return (
      <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
        {/* Logout Button - Top Right - Only show if group session exists */}
        {groupSession && (
          <div className="flex justify-end mb-8">
            <button
              onClick={() => {
                clearGroupSession();
                window.location.reload();
              }}
              className="btn-secondary text-sm px-4 py-2 hover:text-danger hover:border-danger"
            >
              logout
            </button>
          </div>
        )}

        {/* Header - Modern */}
        <div className="mb-12 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 gap-6">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3 tracking-tight">
                groupbet
              </h1>
              <div className="flex items-center gap-2 text-foreground-muted text-lg font-medium">
                <span className="text-info">week {currentWeek}</span>
                <span>•</span>
                <span>{completedGames} of {totalGames} complete</span>
              </div>
            </div>
            
            {/* Tabs - Research vs Bets vs Experimental */}
            <div className="flex gap-2 mb-6 border-b-2 border-gray-700">
              <button
                onClick={() => setActiveTab('research')}
                className={`px-6 py-3 font-semibold text-base transition-all duration-200 relative ${
                  activeTab === 'research'
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500 -mb-0.5'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                Research
              </button>
              <button
                onClick={() => {
                  if (!groupSession) {
                    // Redirect to landing page or show message
                    alert('Please join or start a group to view bets');
                    return;
                  }
                  setActiveTab('bets');
                }}
                className={`px-6 py-3 font-semibold text-base transition-all duration-200 relative ${
                  activeTab === 'bets'
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500 -mb-0.5'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                Bets
              </button>
              <button
                onClick={() => setActiveTab('experimental')}
                className={`px-6 py-3 font-semibold text-base transition-all duration-200 relative ${
                  activeTab === 'experimental'
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500 -mb-0.5'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800/30'
                }`}
              >
                Experimental
              </button>
            </div>
            
            {/* Week Navigation - Streamlined */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => handleWeekChange(Math.max(1, currentWeek - 1))}
                disabled={currentWeek <= 1}
                className={`px-3 py-2 text-sm font-medium transition-all duration-200 rounded-md ${
                  currentWeek <= 1 
                    ? 'opacity-20 cursor-not-allowed text-gray-500 bg-gray-900 border border-gray-800' 
                    : 'text-white bg-gray-800 border border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                }`}
                aria-label="Previous week"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="bg-blue-600 text-white px-5 py-2 rounded-md font-bold text-lg min-w-[3.5rem] text-center shadow-md">
                {currentWeek}
              </div>
              
              <button
                onClick={() => handleWeekChange(Math.min(18, currentWeek + 1))}
                disabled={currentWeek >= 18 || currentWeek >= getCurrentNFLWeek() + 1}
                className={`px-3 py-2 text-sm font-medium transition-all duration-200 rounded-md ${
                  currentWeek >= 18 || currentWeek >= getCurrentNFLWeek() + 1
                    ? 'opacity-20 cursor-not-allowed text-gray-500 bg-gray-900 border border-gray-800' 
                    : 'text-white bg-gray-800 border border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                }`}
                aria-label="Next week"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* User Selection - Compact - Only show if group session exists */}
          {groupSession && (
            <div className="flex items-center justify-between mb-6">
              <UserSelector />
            </div>
          )}
        </div>

        {activeTab === 'research' ? (
          <ResearchPanel week={currentWeek} onPlaceBet={handleResearchBetPlacement} />
        ) : activeTab === 'experimental' ? (
          <ExperimentalPanel week={currentWeek} />
        ) : !groupSession ? (
          <div className="text-center py-24 animate-fade-in">
            <p className="text-foreground-muted text-xl font-medium mb-4">Please join or start a group to view bets</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Landing Page
            </button>
          </div>
        ) : currentUser ? (
          <div className="space-y-16">
            {/* Image Upload Button */}
            <div className="flex justify-center mb-6">
              <ImageBetUpload
                onBetExtracted={async (betData) => {
                  try {
                    await betService.createBet({
                      ...betData,
                      bettingMode: 'group',
                    });
                    
                    // Refresh bets (same logic as BetPopup)
                    if (currentUser) {
                      const weekendId = `2025-week-${currentWeek}`;
                      
                      // Refresh user bets for current week
                      const freshUserBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
                      setUserBets(freshUserBets);
                      
                      // Refresh all week bets from all users for settlement calculations
                      const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
                      const allBets: Bet[] = [];
                      
                      for (const userId of allUserIds) {
                        try {
                          const userWeekBets = await fetchUserBetsViaAPI(userId, weekendId);
                          allBets.push(...userWeekBets);
                        } catch (error) {
                          console.log(`No bets found for user ${userId} in Week ${currentWeek}`);
                        }
                      }
                      
                      // Deduplicate bets
                      const uniqueBets = allBets.reduce((acc: Bet[], current: Bet) => {
                        if (!acc.find(bet => bet.id === current.id)) {
                          acc.push(current);
                        }
                        return acc;
                      }, []);
                      
                      setAllWeekBets(uniqueBets);
                      setLastUpdated(Date.now());
                      
                      console.log(`✅ Refreshed bets from image: ${freshUserBets.length} user bets, ${uniqueBets.length} total week bets`);
                    }
                  } catch (error) {
                    console.error('Failed to create bet from image:', error);
                  }
                }}
                currentUser={currentUser.id}
                defaultParticipants={allUsers.slice(0, 4).map(u => u.id)}
              />
            </div>
            
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
                    <div className="card p-8 animate-scale-in">
                      <h2 className="text-2xl font-bold mb-6 text-foreground">
                        week summary
                      </h2>
                      <div className="text-foreground-muted text-center py-8">
                        no bets placed this week
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="card p-8 animate-scale-in">
                    <h2 className="text-2xl font-bold mb-6 text-foreground">
                      week summary
                    </h2>
                    
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <div className="text-foreground-subtle text-sm font-medium mb-2">in play</div>
                        <div className="text-warning text-2xl font-bold">
                          ${totalInPlay.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-foreground-subtle text-sm font-medium mb-2">profit</div>
                        <div className={`text-2xl font-bold ${
                          netProfit > 0 ? 'text-success' : 
                          netProfit < 0 ? 'text-danger' : 'text-foreground-muted'
                        }`}>
                          {netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-foreground-subtle text-sm font-medium mb-2">record</div>
                        <div className="text-foreground text-2xl font-bold">
                          {wonBets % 1 === 0 ? wonBets.toFixed(0) : wonBets.toFixed(1)}W-{lostBets % 1 === 0 ? lostBets.toFixed(0) : lostBets.toFixed(1)}L
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()} 

              {/* Weekly Settlement - Right Half */}
              {settlements.length > 0 && (
                <div className="card p-8 animate-scale-in" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-1">
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
                            <span className="text-foreground-muted">team is </span>
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
                <div className="card p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-foreground">
                      {currentUser?.name || 'your'} bets • {sortedBets.length}
                    </h2>
                  </div>
                  
                  <div className="bet-grid">
                    {sortedBets.map(bet => {
                    if (!bet) return null;
                    let game = games.find(g => g.id === bet?.gameId);
                    
                    // If game not found by ID, try to match by team names from bet selection
                    if (!game && bet?.selection) {
                      console.log(`🔍 Game not found by ID for bet: ${bet.selection}, trying team name matching...`);
                      game = games.find(g => {
                        const betSelection = bet.selection.toLowerCase();
                        const homeTeam = g.homeTeam.toLowerCase();
                        const awayTeam = g.awayTeam.toLowerCase();
                        
                        // Check if bet selection contains either team name or their short forms
                        const homeWords = homeTeam.split(' ');
                        const awayWords = awayTeam.split(' ');
                        const lastHomeWord = homeWords[homeWords.length - 1];
                        const lastAwayWord = awayWords[awayWords.length - 1];
                        
                        return (
                          betSelection.includes(homeTeam) || 
                          betSelection.includes(awayTeam) ||
                          betSelection.includes(lastHomeWord) ||
                          betSelection.includes(lastAwayWord)
                        );
                      });
                      
                      if (game) {
                        console.log(`✅ Found game by team matching: ${game.awayTeam} @ ${game.homeTeam}`);
                      } else {
                        console.log(`❌ Could not find game for bet: ${bet.selection}`);
                      }
                    }
                    
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
                        resultColor = 'text-warning';
                        resultIcon = '⏳';
                        backgroundColor = 'var(--surface)';
                        borderColor = 'var(--surface-border)';
                      }
                    }
                    
                    // Determine status styling
                    let statusBadgeClass = '';
                    let statusTextClass = '';
                    if (bet?.status === 'won') {
                      statusBadgeClass = 'bg-success-muted text-success border-success';
                      statusTextClass = 'text-success';
                    } else if (bet?.status === 'lost') {
                      statusBadgeClass = 'bg-danger-muted text-danger border-danger';
                      statusTextClass = 'text-danger';
                    } else {
                      statusBadgeClass = 'bg-info-muted text-warning border-warning';
                      statusTextClass = 'text-warning';
                    }
                    
                    return (
                      <div 
                        key={bet?.id || Math.random()} 
                        className="card card-hover p-5 cursor-pointer group animate-scale-in"
                        style={{ 
                          minHeight: '100px',
                          animationDelay: `${(sortedBets.indexOf(bet) * 0.05).toFixed(2)}s`,
                          backgroundColor: bet?.status === 'won' ? 'rgba(16, 185, 129, 0.15)' : 
                                         bet?.status === 'lost' ? 'rgba(239, 68, 68, 0.05)' : 
                                         undefined,
                          border: bet?.status === 'won' ? '2px solid rgba(16, 185, 129, 0.6)' :
                                 bet?.status === 'lost' ? '1px solid rgba(239, 68, 68, 0.2)' :
                                 undefined,
                          boxShadow: bet?.status === 'won' ? '0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 20px rgba(16, 185, 129, 0.05)' :
                                    undefined
                        }}
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
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-semibold text-sm mb-1 truncate">
                              {bet?.betType === 'parlay' ? 
                                `${bet.parlayLegs?.length || 0}-Leg Parlay` : 
                                game ? (
                                  (game.status === 'final' || game.status === 'live') && game.homeScore !== undefined && game.awayScore !== undefined ?
                                    `${game.awayTeam.split(' ').pop()} ${game.awayScore} - ${game.homeScore} ${game.homeTeam.split(' ').pop()}${game.status === 'live' ? ' (LIVE)' : ''}` :
                                    `${game.awayTeam.split(' ').pop()} @ ${game.homeTeam.split(' ').pop()}`
                                ) : (bet as any)?.gameData ? (
                                  `${(bet as any).gameData.awayTeam.split(' ').pop()} ${(bet as any).gameData.awayScore || 0} - ${(bet as any).gameData.homeScore || 0} ${(bet as any).gameData.homeTeam.split(' ').pop()}`
                                ) : 'Game Not Found'
                              }
                            </div>
                            <div className="text-xs text-foreground-subtle truncate">
                              {isHeadToHead ? (
                                userSide === 'A' 
                                  ? `H2H vs ${bet?.sideB?.participants.map(id => allUsers.find(u => u.id === id)?.name || id).join(', ')}`
                                  : userSide === 'B'
                                  ? `H2H vs ${bet?.sideA?.participants.map(id => allUsers.find(u => u.id === id)?.name || id).join(', ')}`
                                  : 'H2H'
                              ) : (bet?.placedBy || 'Unknown')}
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className={`px-2 py-1 rounded-sm text-xs font-medium border ${statusBadgeClass}`}>
                            {resultIcon}
                          </div>
                        </div>
                        
                        {/* Bet Details */}
                        <div className="text-foreground-muted text-sm mb-3">
                          {bet?.betType === 'parlay' && bet?.parlayLegs ? (
                            <div>
                              <div className="truncate mb-1">
                                <span className="font-medium">${bet?.amountPerPerson?.toFixed(0) || '0'}</span> on{' '}
                                <span className="text-foreground-secondary">
                                  {bet.parlayLegs.length}-leg parlay
                                </span>
                              </div>
                              <div className="text-xs space-y-1 mt-2">
                                {bet.parlayLegs.map((leg, idx) => (
                                  <div key={idx} className="text-foreground-subtle flex items-center gap-1">
                                    <span className={leg.status === 'won' ? 'text-success' : leg.status === 'lost' ? 'text-danger' : ''}>
                                      {leg.status === 'won' ? '✓' : leg.status === 'lost' ? '✗' : '·'}
                                    </span>
                                    <span className="truncate">{simplifyTeamName(leg.selection)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-foreground-subtle mt-2 font-medium">
                                Parlay odds: {bet?.parlayOdds ? formatOdds(bet.parlayOdds) : formatOdds(bet.odds)}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="truncate">
                                <span className="font-medium">${bet?.amountPerPerson?.toFixed(0) || '0'}</span> on{' '}
                                <span className="text-foreground-secondary">
                                  {(() => {
                                    let selection = '';
                                    // For over/under bets, show the line clearly
                                    if (bet?.betType === 'over_under' && bet?.line && userSelection) {
                                      const isOver = userSelection.toLowerCase().includes('over');
                                      selection = `${isOver ? 'Over' : 'Under'} ${bet.line}`;
                                    } else {
                                      // For other bets, use existing logic
                                      selection = simplifyPlayerName(simplifyTeamName(userSelection || 'Unknown'));
                                    }
                                    
                                    // Add odds in parentheses
                                    const odds = bet?.odds ? formatOdds(bet.odds) : '(-110)';
                                    return `${selection} ${odds}`;
                                  })()}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Result/Status Footer */}
                        <div className="flex items-center justify-between border-t border-surface-border pt-2">
                          <div className={`text-sm font-bold ${statusTextClass}`}>
                            {betResult}
                          </div>
                          
                          {game && game.status === 'final' && (
                            <div className="text-foreground-subtle text-xs truncate">
                              {bet?.betType === 'player_prop' && bet?.result ? 
                                simplifyPlayerName(bet.result) : 
                                `${game.awayScore}-${game.homeScore}`
                              }
                            </div>
                          )}
                          
                          {game && game.status === 'live' && (
                            <div className="text-success text-xs font-medium flex items-center gap-1">
                              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                              <span>Q{game.quarter || '?'} {game.timeRemaining || 'Live'}</span>
                            </div>
                          )}
                        </div>
                        
                        {!game && bet?.betType !== 'parlay' && (
                          <div className="text-warning text-sm mt-1">
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
                            isParlayMode={isParlayMode}
                            onAddToParlay={handleAddToParlaySelection}
                            parlaySelections={parlaySelections.map(s => s.id)}
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
                <p className="text-foreground-muted text-xl font-medium">no games found for this week</p>
                <p className="text-foreground-subtle text-sm mt-4">
                  Week {currentWeek} • Total games loaded: {games.length}
                </p>
                {games.length > 0 && (
                  <p className="text-warning text-sm mt-2">
                    Games found but don't match Week {currentWeek}. Check weekendId values.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 animate-fade-in">
            <p className="text-foreground-muted text-xl font-medium">select a user to view games and place bets</p>
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
        onStartParlay={(selection) => {
          console.log('🎰 onStartParlay called with selection:', selection);
          // Start parlay mode with this selection
          setIsParlayMode(true);
          console.log('✅ Set isParlayMode to true');
          handleAddToParlaySelection(selection);
          console.log('✅ Added selection to parlay');
          setIsBetPopupOpen(false);
          console.log('✅ Closed bet popup');
        }}
        onPlaceBet={async (betData) => {
          try {
            await betService.createBet(betData);
            setIsBetPopupOpen(false);
            
            // Refresh user bets and all week bets when a new bet is placed
            if (currentUser) {
              const weekendId = `2025-week-${currentWeek}`;
              
              // Refresh user bets for current week
              const freshUserBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
              setUserBets(freshUserBets);
              
              // Refresh all week bets from all users for settlement calculations
              const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
              const allBets: Bet[] = [];
              
              for (const userId of allUserIds) {
                try {
                  const userWeekBets = await fetchUserBetsViaAPI(userId, weekendId);
                  allBets.push(...userWeekBets);
                } catch (error) {
                  console.log(`No bets found for user ${userId} in Week ${currentWeek}`);
                }
              }
              
              // Deduplicate bets
              const uniqueBets = allBets.reduce((acc: Bet[], current: Bet) => {
                if (!acc.find(bet => bet.id === current.id)) {
                  acc.push(current);
                }
                return acc;
              }, []);
              
              setAllWeekBets(uniqueBets);
              
              // Force re-render by updating timestamp
              setLastUpdated(Date.now());
              
              console.log(`✅ Refreshed bets: ${freshUserBets.length} user bets, ${uniqueBets.length} total week bets`);
            }
          } catch (error) {
            console.error('❌ Failed to place bet:', error);
          }
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
        onDelete={handleDeleteBet}
      />
      
      {/* Parlay Builder */}
      <ParlayBuilder
        isOpen={isParlayBuilderOpen}
        onClose={() => setIsParlayBuilderOpen(false)}
        games={(() => {
          const currentWeekGames = games.filter(game => game.weekendId === `2025-week-${currentWeek}`);
          console.log('🎯 PARLAY BUILDER GAMES:', {
            currentWeek,
            totalGames: games.length,
            currentWeekGames: currentWeekGames.length,
            weekendId: `2025-week-${currentWeek}`,
            sampleGames: currentWeekGames.slice(0, 3).map(g => ({ 
              id: g.id, 
              teams: `${g.awayTeam} @ ${g.homeTeam}`,
              spread: g.spread,
              overUnder: g.overUnder,
              homeMoneyline: g.homeMoneyline,
              awayMoneyline: g.awayMoneyline
            }))
          });
          return currentWeekGames;
        })()}
        onCreateParlay={async (parlayData) => {
          try {
            // Create the parlay bet
            const parlayBet = {
              gameId: parlayData.parlayLegs[0].gameId, // Use first leg's game ID as reference
              weekendId: parlayData.weekendId,
              betType: 'parlay' as const,
              selection: `${parlayData.parlayLegs.length}-leg parlay`,
              odds: parlayData.parlayOdds || -110,
              totalAmount: parlayData.totalAmount,
              amountPerPerson: parlayData.amountPerPerson,
              placedBy: parlayData.placedBy,
              participants: parlayData.participants,
              parlayLegs: parlayData.parlayLegs,
              parlayOdds: parlayData.parlayOdds,
              bettingMode: 'group' as const
            };
            
            await betService.createBet(parlayBet);
            setIsParlayBuilderOpen(false);
            
            // Refresh user bets
            if (currentUser) {
              const weekendId = `2025-week-${currentWeek}`;
              const updatedBets = await fetchUserBetsViaAPI(currentUser.id, weekendId);
              setUserBets(updatedBets);
            }
          } catch (error) {
            console.error('Failed to create parlay:', error);
          }
        }}
      />

      {/* Parlay Panel */}
      <ParlayPanel
        isActive={isParlayMode}
        selections={parlaySelections}
        onToggleActive={handleToggleParlayMode}
        onRemoveSelection={handleRemoveParlaySelection}
        onClearAll={handleClearParlaySelections}
        onPlaceParlay={handlePlaceParlay}
      />
    </div>
  );
}
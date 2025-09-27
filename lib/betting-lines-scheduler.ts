/**
 * Automatic Betting Lines Scheduler
 * 
 * Manages scheduled execution of betting lines caching to ensure
 * optimal timing and minimal API usage.
 */

import { bettingLinesCacheService } from '@/lib/betting-lines-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export interface SchedulerRunResult {
  success: boolean;
  weeksProcessed: number[];
  gamesProcessed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export class BettingLinesScheduler {
  
  /**
   * Run automatic betting lines management
   * This should be called by a cron job or scheduled task
   */
  async runAutomaticBettingLinesUpdate(): Promise<SchedulerRunResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    
    console.log('🤖 Starting automatic betting lines update...');
    
    const result: SchedulerRunResult = {
      success: false,
      weeksProcessed: [],
      gamesProcessed: 0,
      errors: [],
      duration: 0,
      timestamp
    };
    
    try {
      // Get current and potentially next week
      const currentWeek = getCurrentNFLWeek();
      const weeksToProcess = [currentWeek];
      
      // Add next week if we're approaching it
      if (await this.shouldProcessNextWeek()) {
        weeksToProcess.push(currentWeek + 1);
      }
      
      console.log(`📅 Processing weeks: ${weeksToProcess.join(', ')}`);
      
      for (const week of weeksToProcess) {
        try {
          if (week >= 1 && week <= 18) {
            console.log(`🎯 Processing Week ${week}...`);
            await bettingLinesCacheService.ensureBettingLinesForWeek(week);
            result.weeksProcessed.push(week);
            
            // Get status to count games processed
            const status = await bettingLinesCacheService.getBettingLinesStatusForWeek(week);
            result.gamesProcessed += status.summary.totalGames;
          } else {
            console.warn(`⚠️ Skipping invalid week: ${week}`);
          }
        } catch (error) {
          const errorMsg = `Error processing Week ${week}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
      
      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Automatic betting lines update completed successfully in ${result.duration}ms`);
        console.log(`📊 Processed ${result.gamesProcessed} games across ${result.weeksProcessed.length} weeks`);
      } else {
        console.warn(`⚠️ Automatic betting lines update completed with ${result.errors.length} errors`);
      }
      
    } catch (error) {
      const errorMsg = `Critical error in automatic betting lines update: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Determine if we should process next week
   * Returns true if current week is ending and we need to prepare for next week
   */
  private async shouldProcessNextWeek(): Promise<boolean> {
    try {
      const currentWeek = getCurrentNFLWeek();
      const now = new Date();
      
      // Get day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = now.getDay();
      const hourOfDay = now.getHours();
      
      // Process next week if it's Wednesday (3) or later in the current week
      // This gives us time to fetch betting lines for upcoming games
      if (dayOfWeek >= 3) {
        console.log(`📅 Day ${dayOfWeek} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}): Processing next week`);
        return true;
      }
      
      // Also process next week if it's Tuesday evening/night
      if (dayOfWeek === 2 && hourOfDay >= 18) {
        console.log(`📅 Tuesday evening: Processing next week`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error determining if next week should be processed:', error);
      return false;
    }
  }
  
  /**
   * Get optimal schedule for running updates
   * Returns cron expressions for different update frequencies
   */
  getOptimalSchedule(): { [key: string]: string } {
    return {
      // Daily checks at strategic times
      morning: '0 6 * * *',     // 6 AM daily - morning check
      midday: '0 12 * * *',     // 12 PM daily - midday check  
      evening: '0 18 * * *',    // 6 PM daily - evening check
      
      // More frequent checks during game days (Thu-Mon)
      gameDay: '*/30 * * * 4,5,6,0,1', // Every 30 minutes Thu-Mon
      
      // Critical pre-game checks
      preGame: '*/15 * * * *',  // Every 15 minutes (use conditionally)
      
      // Weekly planning
      weekly: '0 0 * * 2'       // Tuesdays at midnight - weekly planning
    };
  }
  
  /**
   * Determine which schedule to use based on current time and NFL calendar
   */
  getCurrentScheduleType(): string {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const hourOfDay = now.getHours();
    
    // During NFL game days (Thursday, Sunday, Monday)
    if (dayOfWeek === 4 || dayOfWeek === 0 || dayOfWeek === 1) {
      return 'gameDay';
    }
    
    // Friday and Saturday (preparing for games)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return 'gameDay';
    }
    
    // Default to daily schedule
    return 'daily';
  }
  
  /**
   * Manual trigger for emergency betting lines fetch
   */
  async runEmergencyFetch(weekNumber?: number): Promise<SchedulerRunResult> {
    console.log('🚨 Running emergency betting lines fetch...');
    
    const week = weekNumber || getCurrentNFLWeek();
    
    const startTime = Date.now();
    const result: SchedulerRunResult = {
      success: false,
      weeksProcessed: [],
      gamesProcessed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };
    
    try {
      await bettingLinesCacheService.ensureBettingLinesForWeek(week);
      
      const status = await bettingLinesCacheService.getBettingLinesStatusForWeek(week);
      
      result.success = true;
      result.weeksProcessed = [week];
      result.gamesProcessed = status.summary.totalGames;
      result.duration = Date.now() - startTime;
      
      console.log(`✅ Emergency fetch completed for Week ${week} in ${result.duration}ms`);
      
    } catch (error) {
      const errorMsg = `Emergency fetch failed for Week ${week}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Get scheduler status and next run time
   */
  getSchedulerStatus(): {
    currentWeek: number;
    scheduleType: string;
    nextRunIn: string;
    currentTime: string;
  } {
    const currentWeek = getCurrentNFLWeek();
    const scheduleType = this.getCurrentScheduleType();
    const now = new Date();
    
    // Calculate next run based on schedule type
    let nextRunIn = 'Unknown';
    
    if (scheduleType === 'gameDay') {
      const minutesUntilNext30 = 30 - (now.getMinutes() % 30);
      nextRunIn = `${minutesUntilNext30} minutes`;
    } else {
      const hoursUntilNext6 = 6 - (now.getHours() % 6);
      nextRunIn = `${hoursUntilNext6} hours`;
    }
    
    return {
      currentWeek,
      scheduleType,
      nextRunIn,
      currentTime: now.toISOString()
    };
  }
}

export const bettingLinesScheduler = new BettingLinesScheduler();
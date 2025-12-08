# API Routes Categorization

This document categorizes all API routes in `/app/api/` to identify which are production endpoints vs debug/fix endpoints that should be removed.

## Production Endpoints (Keep)

These endpoints are used by the application in production:

1. **`/api/games`** - Fetch NFL games for a week
2. **`/api/add-bet`** - Create a new bet
3. **`/api/update-bet`** - Update an existing bet
4. **`/api/delete-bet`** - Delete a bet
5. **`/api/resolve-bets`** - Resolve bets based on game results
6. **`/api/auto-resolve-bets`** - Automatically resolve bets for completed games
7. **`/api/weekly-settlement`** - Calculate weekly settlement
8. **`/api/add-player-prop`** - Add player prop to a game
9. **`/api/fetch-player-props`** - Fetch player props for games
10. **`/api/manual-resolve-bet`** - Manually resolve a specific bet
11. **`/api/store-final-results`** - Store final game results

## Debug Endpoints (Remove or Consolidate)

These endpoints are for debugging and should be removed or consolidated:

1. **`/api/debug-bets`** - Debug bet data
2. **`/api/debug-games`** - Debug game data
3. **`/api/debug-games-cache`** - Debug games cache
4. **`/api/debug-player-props`** - Debug player props
5. **`/api/debug-props-preservation`** - Debug props preservation
6. **`/api/debug-seahawks-cardinals`** - Debug specific game
7. **`/api/debug-seahawks-firebase`** - Debug Firebase data for specific game
8. **`/api/debug-time-slots`** - Debug time slot assignments
9. **`/api/debug-week4-times`** - Debug Week 4 game times
10. **`/api/check-bets`** - Check bet data (debugging)
11. **`/api/check-firebase-cache`** - Check Firebase cache (debugging)
12. **`/api/check-firebase-game`** - Check Firebase game data (debugging)
13. **`/api/check-packers-bet`** - Check specific bet (debugging)
14. **`/api/check-thursday-game`** - Check specific game (debugging)
15. **`/api/find-cardinals-game`** - Find specific game (debugging)

**Recommendation**: Consolidate into `/api/debug` with query parameters, or remove entirely if no longer needed.

## One-Off Fix Endpoints (Remove)

These endpoints were created to fix specific issues and should be removed:

1. **`/api/fix-dio-to-do`** - Fixed dio -> d/o (already fixed, can remove)
2. **`/api/fix-dio-userid`** - Fixed d/o vs dio inconsistency (already fixed, can remove)
3. **`/api/fix-user-id-case`** - Fixed user ID case mismatches (keep for normalization)
4. **`/api/fix-user-names`** - Fixed user names (keep for normalization)
5. **`/api/fix-kelce-bet`** - Fixed specific Kelce bet (one-off, remove)
6. **`/api/fix-packers-bet`** - Fixed specific Packers bet (one-off, remove)
7. **`/api/fix-packers-bet-final`** - Fixed Packers bet final (one-off, remove)
8. **`/api/fix-corrupted-bet`** - Fixed corrupted bet (one-off, remove)
9. **`/api/fix-participants`** - Fixed participant mismatches (keep if still needed)
10. **`/api/fix-time-slots`** - Fixed time slot assignments (one-off, remove)
11. **`/api/force-fix-timeslots`** - Force fix time slots (one-off, remove)
12. **`/api/fix-all-week4-times`** - Fixed Week 4 times (one-off, remove)
13. **`/api/fix-week-assignments`** - Fixed week assignments (one-off, remove)
14. **`/api/fix-week3-game-ids`** - Fixed Week 3 game IDs (one-off, remove)
15. **`/api/fix-week4-statuses`** - Fixed Week 4 statuses (one-off, remove)
16. **`/api/fix-game-mapping`** - Fixed game mapping (one-off, remove)

**Recommendation**: Remove all one-off fix endpoints. If similar fixes are needed in the future, create a generic fix endpoint.

## Cleanup Endpoints (Remove)

These endpoints were for one-time data cleanup:

1. **`/api/clean-firebase-duplicates`** - Cleaned Firebase duplicates (one-time, remove)
2. **`/api/clean-week3-duplicates`** - Cleaned Week 3 duplicates (one-time, remove)
3. **`/api/clean-week4-duplicates`** - Cleaned Week 4 duplicates (one-time, remove)
4. **`/api/force-delete-week3-duplicates`** - Force deleted Week 3 duplicates (one-time, remove)

**Recommendation**: Remove all cleanup endpoints.

## Test Endpoints (Remove)

These endpoints are for testing and should be removed:

1. **`/api/test-betting-lines-cache`** - Test betting lines cache
2. **`/api/test-direct-player-props`** - Test direct player props
3. **`/api/test-game-mapping`** - Test game mapping
4. **`/api/test-infinite-loop-fix`** - Test infinite loop fix
5. **`/api/test-odds-api`** - Test Odds API
6. **`/api/test-player-props`** - Test player props

**Recommendation**: Remove all test endpoints. Use unit tests instead.

## Migration Endpoints (Review)

These endpoints were for data migration:

1. **`/api/migrate-bets`** - Migrate bets
2. **`/api/migrate-bet-weeks`** - Migrate bet weeks
3. **`/api/populate-game-mappings`** - Populate game mappings
4. **`/api/repair-game-mappings`** - Repair game mappings

**Recommendation**: Review if migrations are complete. If yes, remove. If no, document when they can be removed.

## Utility Endpoints (Review)

These endpoints provide utility functions:

1. **`/api/clear-cache`** - Clear cache (useful for admin)
2. **`/api/check-all-weeks`** - Check all weeks (debugging/utility)
3. **`/api/audit-firebase-games`** - Audit Firebase games (utility)
4. **`/api/reset-bets`** - Reset bets (dangerous, review)
5. **`/api/auto-resolve`** - Auto resolve (duplicate of auto-resolve-bets?)
6. **`/api/get-parlay`** - Get parlay (check if used)
7. **`/api/betting-lines/cache`** - Betting lines cache management
8. **`/api/betting-lines/scheduler`** - Betting lines scheduler

**Recommendation**: 
- Keep `/api/clear-cache` if needed for admin operations
- Review others and remove if not used
- Consolidate `/api/auto-resolve` and `/api/auto-resolve-bets` if duplicates

## Summary

- **Production Endpoints**: ~11 endpoints (keep)
- **Debug Endpoints**: ~15 endpoints (remove or consolidate)
- **One-Off Fix Endpoints**: ~16 endpoints (remove)
- **Cleanup Endpoints**: ~4 endpoints (remove)
- **Test Endpoints**: ~6 endpoints (remove)
- **Migration Endpoints**: ~4 endpoints (review and remove if complete)
- **Utility Endpoints**: ~8 endpoints (review and keep only if needed)

**Total to Remove**: ~45 endpoints
**Total to Keep**: ~11-15 endpoints (depending on utility review)

## Action Plan

1. **Phase 1**: Remove all test endpoints (6 endpoints)
2. **Phase 2**: Remove all one-off fix endpoints (16 endpoints)
3. **Phase 3**: Remove all cleanup endpoints (4 endpoints)
4. **Phase 4**: Consolidate or remove debug endpoints (15 endpoints)
5. **Phase 5**: Review and remove migration endpoints if complete (4 endpoints)
6. **Phase 6**: Review utility endpoints and keep only necessary ones (8 endpoints)



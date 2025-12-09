# Over/Under Analysis Improvements

## 📊 Statistical Adjustments Added

The enhanced analysis now includes several statistical adjustments based on historical NFL trends:

### 1. **Thursday Night Football Adjustment: -2.5 points**
- **Rationale**: Thursday night games historically score 2-3 points lower on average
- **Data**: 2024 TNF games averaged 45.49 points vs ~48 points for Sunday games
- **Reasons**:
  - Short rest (only 3-4 days between games)
  - Less preparation time
  - Higher injury/fatigue rates
  - More conservative play-calling

### 2. **Monday Night Football Adjustment: -1.0 points**
- **Rationale**: Monday night games show slightly lower scoring
- **Reasons**: Similar to Thursday but less extreme (more rest days)

### 3. **Bye Week Adjustment: +1.5 points per team**
- **Rationale**: Teams coming off a bye week typically perform better
- **Data**: Teams off bye win ~60% of games and score ~1.5 more points on average
- **Reasons**:
  - Extra rest and recovery time
  - More preparation time for opponent
  - Healthier roster (injuries heal)
  - Better game planning

### 4. **Home Field Advantage: +1.25 points to total**
- **Rationale**: Home teams score ~2.5 more points, but only half affects the total
- **Standard NFL adjustment**: Already included in base model

## 🔍 How It Works

### Bye Week Detection
The script checks if a team played in the previous week:
- If a team **did NOT** play in Week N-1, they're coming off a bye
- Both teams can be off bye (adds +3.0 total points)
- Only one team off bye (adds +1.5 total points)

### Game Type Detection
Based on the game time and day of week:
- **Thursday** (Day 4): -2.5 points
- **Monday** (Day 1): -1.0 points  
- **Sunday** (Day 0): No adjustment

### Example Calculation

**Scenario**: Atlanta Falcons @ Tampa Bay Buccaneers (Thursday Night)
- Base projection: 52.0 points
- Thursday Night adjustment: -2.5 points
- Atlanta off bye: +1.5 points
- Tampa Bay off bye: +1.5 points
- **Final projection**: 52.0 - 2.5 + 1.5 + 1.5 = **52.5 points**

## 📈 Additional Factors to Consider (Future Enhancements)

### Potential Future Additions:

1. **Divisional Games**
   - Teams in same division play twice per year
   - Can be more competitive (lower scoring) or more familiar (higher scoring)
   - **Suggested**: Small adjustment based on historical divisional game data

2. **Rest Advantage**
   - Teams with more days of rest (e.g., 10+ days) vs teams with short rest (3-4 days)
   - **Suggested**: +0.5 to +1.0 points for significant rest advantage

3. **Recent Form/Momentum**
   - Teams on winning streaks may score more
   - Teams on losing streaks may score less
   - **Suggested**: Small adjustment based on last 3 games W/L record

4. **Pace of Play**
   - Some teams play faster (more plays = more scoring opportunities)
   - **Suggested**: Factor in plays per game or time of possession

5. **Weather Impact** (Already partially implemented)
   - Cold weather (< 40°F): -1 to -2 points
   - Rain/Snow: -2 to -4 points
   - Wind (> 15 mph): -1 to -3 points
   - **Status**: Weather data fetched but not yet automatically factored into projections

6. **Key Player Injuries** (Manual check required)
   - Missing starting QB: -3 to -5 points
   - Missing top WR/RB: -1 to -2 points
   - Missing key defensive player: +1 to +2 points
   - **Status**: Requires manual checking (ESPN API doesn't provide injury data)

## 🎯 Confidence Levels

The confidence levels remain the same:
- **High**: Difference ≥ 4 points between projection and line
- **Medium**: Difference ≥ 2 points
- **Low**: Difference < 2 points

However, with the new adjustments, projections should be more accurate, leading to:
- More high-confidence bets
- Better edge identification
- More reliable recommendations

## ⚠️ Important Notes

1. **Adjustments are based on historical averages** - individual games may vary
2. **Bye week detection** requires checking previous week's games (adds API calls)
3. **Thursday/Monday adjustments** are conservative estimates - actual impact can vary
4. **Weather adjustments** are not yet automated (requires forecast data closer to game time)
5. **Injury adjustments** require manual checking (not available via API)

## 📊 Validation

To validate these adjustments:
1. Run analysis on past weeks
2. Compare adjusted vs unadjusted projections
3. Track accuracy of recommendations
4. Refine adjustment values based on results

---

*Last updated: December 8, 2025*

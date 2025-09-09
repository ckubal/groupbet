# Development Phases

## Phase 1: Core Hub (2-3 weeks)
**Goal:** Replace text-based game coordination

### Features
- [ ] Display NFL schedule + odds by time slot
  - Thursday Night Football  
  - Sunday early games (1pm ET)
  - Sunday late games (4pm ET) 
  - Sunday Night Football
  - Monday Night Football
- [ ] Simple voting system (thumbs up/down on games)
- [ ] Group alignment view (sort by consensus level)
- [ ] Basic authentication (shared access code or magic link)
- [ ] Real-time vote count updates

### Success Criteria
- Group can see weekly games and vote on picks
- Clear view of which games have most agreement
- No more "what games do you guys like" texts

## Phase 2: Bet Tracking (2-3 weeks) 
**Goal:** Move from votes to actual money tracking

### Features
- [ ] Manual bet entry form
  - Select from current week's games
  - Auto-populate current odds (editable)
  - Tag participating group members
  - Auto-calculate payouts
- [ ] Text parsing for betting slips
  - Paste Bovada/Str8Play confirmation text
  - Auto-parse bet details, pre-fill form
- [ ] Live game scores integration
- [ ] Bet status tracking (pending/won/lost)

### Success Criteria  
- Easy bet logging with participant tracking
- Live updates on bet performance
- Clear view of active vs settled bets

## Phase 3: Settlement Engine (1-2 weeks)
**Goal:** Automate weekend money calculations

### Features
- [ ] Auto win/loss marking when games finish
- [ ] Weekend settlement summary
  - Each person's net position
  - Simplified "who owes who" breakdown
- [ ] Settlement debt optimization algorithm
- [ ] Historical tracking of payouts

### Success Criteria
- Automatic settlement calculations
- Clear payout instructions
- No more manual money math

## Phase 4: Advanced Features (Future)
**Goal:** Polish and automation

### Potential Features
- [ ] Screenshot OCR for betting slips  
- [ ] Push notifications for game starts
- [ ] iMessage app extension
- [ ] Historical performance tracking
- [ ] Season-long leaderboards

## Technical Milestones
- [ ] Phase 1: Basic PWA with Firebase backend
- [ ] Phase 2: Odds API integration + slip parsing
- [ ] Phase 3: Settlement calculation engine
- [ ] Phase 4: Mobile app enhancements

## Timeline Estimate
- **Phase 1:** 2-3 weeks (MVP functionality)
- **Phase 2:** 2-3 weeks (bet tracking)  
- **Phase 3:** 1-2 weeks (settlement)
- **Polish/Testing:** 1-2 weeks
- **Total:** 6-10 weeks for solid v1
# Technical Considerations

## Architecture Decisions

### Frontend: Next.js PWA
- **Why:** Perfect for your no-download requirement
- **Benefits:** 
  - Built-in PWA support
  - Server-side rendering for performance
  - Easy deployment to Vercel
  - Works on all devices via web browser
  - "Add to Home Screen" functionality

### Backend: Firebase
- **Why:** Real-time updates crucial for group betting
- **Services:**
  - **Firestore:** Real-time database for votes, bets, scores
  - **Firebase Auth:** Simple email/magic link authentication  
  - **Cloud Functions:** Settlement calculations, API integrations
  - **Hosting:** Static asset serving

### APIs Required
- **The Odds API:** NFL odds and lines
  - Free tier: 500 requests/month (sufficient for testing)
  - Paid: $25/month for real-time updates
- **ESPN API:** Live scores and game status
  - Free tier available
  - Reliable for NFL data

### Hosting: Vercel
- **Why:** Seamless Next.js deployment
- **Benefits:**
  - Zero-config PWA support
  - Edge functions for fast API responses
  - Free tier sufficient for small group

## Key Technical Features

### Real-Time Sync Strategy
- Use Firestore real-time listeners
- Critical for: vote tallies, live scores, bet status
- Nice-to-have for: settlement updates, game status

### Authentication Strategy  
**Phase 1:** Simple approach for small group
- Magic link via email (no passwords)
- Or shared group access code
- Store user preferences in localStorage

**Future:** More robust
- Firebase Auth with social providers
- User profile management

### Betting Slip Parsing
**Phase 1:** Text parsing (more reliable)
- Copy/paste bet confirmation text
- Regex patterns for Bovada and Str8Play
- Auto-populate bet entry form

**Phase 2:** OCR (advanced)
- Google Vision API for text extraction
- Fall back to manual entry if parsing fails

### Database Schema Design
```
Users: { id, name, email, preferences }
Games: { id, week, teams, odds, scores, status }
Votes: { userId, gameId, voteType, betCategory }  
Bets: { id, gameId, participants, amounts, odds, status }
Settlements: { weekId, userBalances, transactions }
```

## Performance Considerations
- Cache odds data (update every 15 minutes)
- Optimize Firestore queries with proper indexing
- Use Next.js image optimization
- Implement service worker for offline functionality

## Security Notes
- Never store actual money/financial accounts
- All transactions are IOU-based between friends
- Input validation on all bet parsing
- Rate limiting on odds API calls

## Development Environment
- **Node.js:** Latest LTS version
- **Package Manager:** npm or yarn
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint + Prettier
- **Version Control:** Git with feature branches

## Deployment Pipeline
1. **Development:** Local dev server with Firebase emulators
2. **Staging:** Vercel preview deployments  
3. **Production:** Vercel production with Firebase prod database

## Monitoring & Analytics
- Firebase Analytics for user engagement
- Error tracking with Sentry
- API usage monitoring for rate limiting
- Performance monitoring with Web Vitals

## Cost Estimates (Monthly)
- **Firebase:** Free tier (small usage)
- **The Odds API:** $25/month (real-time odds)
- **Vercel:** Free tier (sufficient traffic)
- **Google Vision API:** Pay-per-use ($1.50/1000 images)

**Total:** ~$30/month for production-ready app
# GroupBet Deployment Guide

## 🚀 Vercel Deployment

### Prerequisites
- Vercel account
- Firebase project for production
- Environment variables configured

### Quick Deploy
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

### Environment Variables Needed
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

### Features Enabled
- ✅ Automatic bet resolution (runs hourly via cron)
- ✅ Real-time game updates from ESPN
- ✅ Settlement calculations
- ✅ Head-to-head and group betting
- ✅ Custom lines and odds preservation

### Post-Deploy Checklist
- [ ] Test user creation and selection
- [ ] Place a test bet and verify it appears
- [ ] Check that completed games resolve bets automatically
- [ ] Verify settlement calculations are accurate
- [ ] Test edit bet functionality
- [ ] Check mobile responsiveness

### Monitoring
- Check `/api/auto-resolve` logs for bet resolution status
- Monitor Firebase usage for quota limits
- Verify cron jobs are running on schedule

### Troubleshooting
- If bets aren't resolving: Check `/api/auto-resolve` endpoint manually
- If games aren't loading: Verify ESPN API access
- If settlements are wrong: Check user IDs match between bets and settlement system
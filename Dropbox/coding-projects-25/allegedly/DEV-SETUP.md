# 🚀 Development Setup Guide

## Quick Start (Recommended)

```bash
# Use the reliable start script
./start-dev.sh

# Or specify a different port
./start-dev.sh 3002
```

## Manual Development Commands

### Start Development Server
```bash
# Standard start
npm run dev

# Clean start (if having issues)
npm run dev:clean

# Debug mode
npm run dev:debug

# Kill any process on port 3001
npm run kill-port
```

## Common Issues & Solutions

### 🔴 "This site can't be reached" / ERR_CONNECTION_REFUSED

**Causes & Solutions:**

1. **Port Conflict**
   ```bash
   # Kill existing processes
   npm run kill-port
   # Or manually
   lsof -ti :3001 | xargs kill -9
   ```

2. **Next.js Cache Issues**
   ```bash
   # Clean and restart
   npm run dev:clean
   ```

3. **Node Process Stuck**
   ```bash
   # Check for stuck Node processes
   ps aux | grep node
   # Kill if needed
   killall node
   ```

4. **Wrong Directory**
   ```bash
   # Make sure you're in the project root
   pwd
   # Should show: /Users/.../allegedly
   ls package.json # Should exist
   ```

### 🔴 Server Starts But Page Won't Load

1. **Try different URLs:**
   - http://localhost:3001
   - http://127.0.0.1:3001
   - http://0.0.0.0:3001

2. **Check firewall/antivirus**
   - Temporarily disable
   - Add Node.js to allowed apps

3. **Use different port**
   ```bash
   ./start-dev.sh 3002
   ```

### 🔴 "Turbopack" Warnings

These are safe to ignore:
```
⚠ Invalid next.config.js options detected: 
⚠ Unrecognized key(s) in object: 'turbopack'
```

## Best Practices for Reliable Development

### 1. Use the Start Script
Always use `./start-dev.sh` instead of `npm run dev` directly.

### 2. Environment Setup
Check your `.env.local` file exists with proper variables.

### 3. Regular Cleanup
```bash
# Clean Next.js cache weekly
rm -rf .next
# Reinstall dependencies if issues persist
rm -rf node_modules package-lock.json
npm install
```

### 4. Port Management
- Default: Port 3001
- If 3001 is busy, try 3002, 3003, etc.
- Always kill old processes before starting

### 5. Browser Cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Disable cache in DevTools while developing

## Development Workflow

### Daily Startup
```bash
cd /path/to/allegedly
./start-dev.sh
# Wait for "✅ Server is ready!"
# Open http://localhost:3001
```

### When Making Changes
- Save files → Hot reload happens automatically
- If hot reload breaks → Restart with `./start-dev.sh`

### Before Committing
```bash
npm run lint    # Check for code issues
npm test       # Run betting parser tests
npm run build  # Test production build
```

## Debugging Tips

### 1. Check Server Logs
The start script shows colored output:
- 🟢 Green = Success
- 🟡 Yellow = Warning
- 🔴 Red = Error

### 2. Network Issues
```bash
# Check what's using your port
lsof -i :3001

# Check network connectivity
curl http://localhost:3001
```

### 3. Next.js Debug Info
Enable debug mode:
```bash
DEBUG=* npm run dev
```

### 4. Browser DevTools
- Network tab: Check if requests are failing
- Console: Look for JavaScript errors
- Application tab: Check service workers/storage

## Emergency Reset

If nothing works, nuclear reset:
```bash
# Kill all Node processes
killall node

# Clean everything
rm -rf .next node_modules package-lock.json

# Reinstall
npm install

# Fresh start
./start-dev.sh
```

## Success Indicators

You'll know it's working when you see:
```
✅ Server is ready!
🔗 http://localhost:3001
   ▲ Next.js 15.5.2 (Turbopack)
   - Local:        http://localhost:3001
   ✓ Ready in 909ms
```

## Getting Help

If you're still having issues:
1. Check the terminal output for specific error messages
2. Try the emergency reset procedure above
3. Make sure you're in the right directory (`/allegedly`)
4. Verify Node.js version: `node --version` (should be 18+)

---

**Pro Tip**: Bookmark `http://localhost:3001` and always use the start script for consistent results!
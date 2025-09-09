#!/bin/bash

# Start development server script with error handling
# Usage: ./start-dev.sh [port]

# Default port
PORT=${1:-3001}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Allegedly development server...${NC}"

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port $PORT is in use. Killing existing processes...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Make sure you're in the project directory.${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Clean Next.js cache
echo -e "${YELLOW}🧹 Cleaning Next.js cache...${NC}"
rm -rf .next 2>/dev/null || true

# Start the development server
echo -e "${GREEN}🌟 Starting Next.js server on port $PORT...${NC}"
echo -e "${GREEN}📱 Access your app at: http://localhost:$PORT${NC}"
echo -e "${GREEN}🛑 Press Ctrl+C to stop the server${NC}"
echo ""

# Start with better error handling
npm run dev -- --port $PORT --hostname 0.0.0.0 2>&1 | while IFS= read -r line; do
    echo "$line"
    # Check for ready state
    if echo "$line" | grep -q "Ready in"; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        echo -e "${GREEN}🔗 http://localhost:$PORT${NC}"
    fi
    # Check for errors
    if echo "$line" | grep -q "Error:"; then
        echo -e "${RED}❌ Server error detected${NC}"
    fi
done
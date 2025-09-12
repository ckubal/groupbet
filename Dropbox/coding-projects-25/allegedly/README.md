# GroupBet 🏈
## NFL Betting Coordination App

A modern NFL betting coordination app with futuristic glassmorphism UI design. Help your group make informed betting decisions through voting, consensus analysis, and streamlined bet placement.

## ✨ Features

### 🎨 Modern UI Design
- **Glassmorphism Interface**: Dark theme with blur effects and transparency
- **Horizontal Game Cards**: Intuitive betting layout with team-focused design
- **Mobile-First**: Responsive design optimized for all devices
- **Action-Oriented**: Focus on what to bet, not just analysis

### 🗳️ Group Voting & Consensus
- **Study Phase**: Vote on spreads, totals, and moneylines for upcoming games
- **Player Props**: Expandable sections with over/under betting options
- **Floating Tracker**: Real-time pick counter with progress to next phase
- **Time-Based Organization**: Games grouped by Thursday, Sunday, Monday slots

### 🎯 Smart Bet Placement
- **Consensus-Based Recommendations**: Shows strongest group picks first (Unanimous → Strong → Majority)
- **Expandable Bet Cards**: Click to configure amount, odds, participants
- **Bet Placer Selection**: Choose who places each bet
- **Participant Management**: Select who's in on each wager
- **Editable Odds**: Adjust if sportsbook odds differ

## 🚀 Tech Stack

- **Framework**: Next.js 14 + React + TypeScript
- **Styling**: Tailwind CSS with custom glassmorphism effects
- **Icons**: Lucide React
- **Data**: The Odds API (with mock data fallback)
- **State**: Local storage for persistence

## 📦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ckubal/groupbet.git
cd groupbet

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Setup (Optional)

For live NFL data, create `.env.local`:

```bash
NEXT_PUBLIC_ODDS_API_KEY=your_odds_api_key
```

The app works with mock data by default if no API key is provided.

## 🎮 How to Use

### 1. Study Phase (`/voting`)
- Select your user from the dropdown
- Vote on spreads, totals, and moneylines for upcoming games
- Expand "player props" for additional betting options
- Track your picks with the floating counter

### 2. Alignment & Betting (`/consensus`)
- View group consensus picks organized by strength
- Click bet cards to expand and configure:
  - Set bet amount (default: $100)
  - Choose who's placing the bet
  - Select participants
  - Edit odds if needed
- Place bets with one click

### 3. Navigation
- **Study**: Vote on games and build consensus
- **Alignment & Bets**: Place actual bets based on group picks
- **Live Tracking**: Monitor active bets (coming soon)
- **Settlement**: Weekend payout calculations (coming soon)

## 🗂️ Project Structure

```
groupbet/
├── src/
│   ├── app/           # Next.js pages (voting, consensus, live, settlement)
│   ├── components/    # UI components (GameCardHorizontal, BetPlacer, etc.)
│   └── lib/          # Utilities and API integration
├── public/           # Static assets
└── CLAUDE.md        # Development documentation
```

## 🔧 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run typecheck    # TypeScript checking
npm run lint         # Code linting
```

## 🚀 Deployment

The app is ready for deployment on Vercel, Netlify, or any Node.js hosting platform.

```bash
npm run build
npm start
```

---

**GroupBet** - Modern NFL betting coordination with style ⚡
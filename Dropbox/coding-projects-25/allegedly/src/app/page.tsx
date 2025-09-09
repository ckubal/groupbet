import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Allegedly 🏈
          </h1>
          <p className="text-gray-600">
            NFL Betting Group Coordination
          </p>
        </header>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  🎯 NFL Week 1 Betting
                </h2>
                <p className="text-gray-600">
                  Vote on spreads, totals, and moneylines. See group consensus and make picks.
                </p>
              </div>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Start Voting
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* Phase 2: Coming Soon */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-xs font-medium text-yellow-600 uppercase">Phase 2</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              💰 Bet Tracking
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Log actual bets and track who's participating in each wager
            </p>
            <div className="text-xs text-gray-500">
              Coming soon
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-xs font-medium text-yellow-600 uppercase">Phase 2</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              📱 Slip Parsing
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Parse Bovada & Str8Play betting slips automatically from text
            </p>
            <div className="text-xs text-gray-500">
              Parsers ready, UI coming soon
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-xs font-medium text-yellow-600 uppercase">Phase 2</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              🏁 Live Tracking
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Real-time scores and bet performance during games
            </p>
            <div className="text-xs text-gray-500">
              Coming soon
            </div>
          </div>

          {/* Phase 3: Future */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-400">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-xs font-medium text-gray-600 uppercase">Phase 3</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              💸 Settlement
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Automatic weekend settlement with "who owes who" calculations
            </p>
            <div className="text-xs text-gray-500">
              Algorithm ready, UI planned
            </div>
          </div>
        </div>

        {/* Test Parsers Section */}
        <div className="mt-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              🧪 Test the Betting Slip Parsers
            </h3>
            <p className="text-gray-600 mb-4">
              Our Bovada and Str8Play parsers are working and tested! You can test them now:
            </p>
            <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm">
              <div className="text-gray-700">npm test</div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              ✅ All 12 test cases passing<br/>
              ✅ Supports single bets, parlays, and props<br/>
              ✅ Auto-detects platform from slip text<br/>
              ✅ Calculates payouts from American odds
            </div>
          </div>
        </div>

        {/* Tech Stack Info */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              🚧 Built With
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Next.js 15 with Turbopack • TypeScript • Tailwind CSS</div>
              <div>Firebase (Firestore + Auth) • PWA Support</div>
              <div>Real-time voting • Betting slip parsers • Settlement algorithms</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
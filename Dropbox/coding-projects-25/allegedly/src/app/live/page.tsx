'use client';

import { useState, useEffect } from 'react';
import { ActualBet } from '@/components/ActualBetsTracker';
import LiveGameTracker from '@/components/LiveGameTracker';
import BettingPerformanceTracker from '@/components/BettingPerformanceTracker';
import TabLayout from '@/components/TabLayout';
import { Clock, Trophy, TrendingUp } from 'lucide-react';

const friendGroup = [
  { id: 'charlie', name: 'Charlie' },
  { id: 'rosen', name: 'Rosen' },
  { id: 'will', name: 'Will' },
  { id: 'do', name: 'D.O.' },
  { id: 'pat', name: 'Pat' },
];

export default function LiveTrackingPage() {
  const [actualBets, setActualBets] = useState<ActualBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved bets
    const savedBets = localStorage.getItem('allegedly-actual-bets');
    if (savedBets) {
      try {
        const parsedBets = JSON.parse(savedBets);
        setActualBets(parsedBets);
      } catch (error) {
        console.error('Failed to load saved bets:', error);
      }
    }
    setLoading(false);
  }, []);

  const handleUpdateBet = (betId: string, updates: Partial<ActualBet>) => {
    setActualBets(prev => {
      const updated = prev.map(bet => 
        bet.id === betId ? { ...bet, ...updates } : bet
      );
      // Save to localStorage
      localStorage.setItem('allegedly-actual-bets', JSON.stringify(updated));
      return updated;
    });
  };

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading live data...</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  const activeBets = actualBets.filter(bet => 
    bet.status === 'pending' || bet.status === 'live'
  );

  const settledBets = actualBets.filter(bet => 
    bet.status === 'won' || bet.status === 'lost' || bet.status === 'push'
  );

  return (
    <TabLayout>
      <div className="space-y-8">
        {/* Live Game Tracking */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Clock className="text-blue-600" size={24} />
              Live Game Tracking
            </h2>
            <p className="text-gray-600">
              Real-time scores, player stats, and bet results
            </p>
          </div>

          <LiveGameTracker
            actualBets={actualBets}
            onUpdateBet={handleUpdateBet}
          />
        </section>

        {/* Performance Tracking */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Trophy className="text-yellow-600" size={24} />
              Betting Performance
            </h2>
            <p className="text-gray-600">
              Track wins, losses, and overall performance
            </p>
          </div>

          <BettingPerformanceTracker
            actualBets={actualBets}
            users={friendGroup}
          />
        </section>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{activeBets.length}</div>
            <div className="text-sm text-gray-600">Active Bets</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {settledBets.filter(b => b.status === 'won').length}
            </div>
            <div className="text-sm text-gray-600">Wins</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {settledBets.filter(b => b.status === 'lost').length}
            </div>
            <div className="text-sm text-gray-600">Losses</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {settledBets.filter(b => b.status === 'push').length}
            </div>
            <div className="text-sm text-gray-600">Pushes</div>
          </div>
        </div>

        {/* Recent Results */}
        {settledBets.length > 0 && (
          <section className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="text-green-600" size={20} />
              Recent Results
            </h3>
            
            <div className="space-y-3">
              {settledBets.slice(-5).reverse().map(bet => (
                <div key={bet.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">
                        {bet.game.awayTeam} @ {bet.game.homeTeam}
                      </div>
                      {bet.type === 'head_to_head' && bet.h2h ? (
                        <div className="text-sm text-purple-700 mt-1">
                          ⚔️ H2H: {bet.h2h.sideA.selection} vs {bet.h2h.sideB.selection}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 mt-1">
                          {bet.betDetails.selection} ({bet.betDetails.odds > 0 ? '+' : ''}{bet.betDetails.odds})
                        </div>
                      )}
                    </div>
                    
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      bet.status === 'won' ? 'bg-green-100 text-green-800' :
                      bet.status === 'lost' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {bet.status.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 mt-2">
                    Participants: {bet.participants.map(p => 
                      friendGroup.find(u => u.id === p)?.name || p
                    ).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </TabLayout>
  );
}
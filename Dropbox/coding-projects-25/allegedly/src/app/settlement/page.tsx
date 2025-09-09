'use client';

import { useState, useEffect } from 'react';
import { ActualBet } from '@/components/ActualBetsTracker';
import WeekendSettlement, { WeeklySettlement } from '@/components/WeekendSettlement';
import SeasonalLedger from '@/components/SeasonalLedger';
import TabLayout from '@/components/TabLayout';
import { Calculator, BarChart3 } from 'lucide-react';

const friendGroup = [
  { id: 'charlie', name: 'Charlie' },
  { id: 'rosen', name: 'Rosen' },
  { id: 'will', name: 'Will' },
  { id: 'do', name: 'D.O.' },
  { id: 'pat', name: 'Pat' },
];

export default function SettlementPage() {
  const [actualBets, setActualBets] = useState<ActualBet[]>([]);
  const [weeklySettlements, setWeeklySettlements] = useState<WeeklySettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved data
    const savedBets = localStorage.getItem('allegedly-actual-bets');
    if (savedBets) {
      try {
        const parsedBets = JSON.parse(savedBets);
        setActualBets(parsedBets);
      } catch (error) {
        console.error('Failed to load saved bets:', error);
      }
    }

    const savedSettlements = localStorage.getItem('allegedly-settlements');
    if (savedSettlements) {
      try {
        const parsedSettlements = JSON.parse(savedSettlements);
        setWeeklySettlements(parsedSettlements);
      } catch (error) {
        console.error('Failed to load saved settlements:', error);
      }
    }

    setLoading(false);
  }, []);

  const handleWeekendSettlement = (settlementData: WeeklySettlement) => {
    const updatedSettlements = [...weeklySettlements, settlementData];
    setWeeklySettlements(updatedSettlements);
    
    // Save to localStorage
    localStorage.setItem('allegedly-settlements', JSON.stringify(updatedSettlements));
  };

  if (loading) {
    return (
      <TabLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">Loading settlement data...</div>
          </div>
        </div>
      </TabLayout>
    );
  }

  return (
    <TabLayout>
      <div className="space-y-8">
        {/* Weekend Settlement */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <Calculator className="text-green-600" size={24} />
              Weekend Settlement
            </h2>
            <p className="text-gray-600">
              Automatic calculation and tracking of who owes whom
            </p>
          </div>

          <WeekendSettlement
            actualBets={actualBets}
            users={friendGroup}
            onSettlement={handleWeekendSettlement}
          />
        </section>

        {/* Seasonal Ledger */}
        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
              <BarChart3 className="text-blue-600" size={24} />
              Season Ledger
            </h2>
            <p className="text-gray-600">
              Track long-term performance across the season
            </p>
          </div>

          <SeasonalLedger
            actualBets={actualBets}
            settlements={weeklySettlements}
            users={friendGroup}
          />
        </section>

        {/* Past Settlements */}
        {weeklySettlements.length > 0 && (
          <section className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Past Settlements</h3>
            
            <div className="space-y-4">
              {weeklySettlements.slice().reverse().map(settlement => (
                <div key={settlement.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="font-medium">
                        Week of {new Date(settlement.weekStart).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Action: ${settlement.totalAction.toFixed(2)}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      settlement.isSettled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {settlement.isSettled ? 'SETTLED' : 'PENDING'}
                    </div>
                  </div>
                  
                  {settlement.transactions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Transactions:</div>
                      {settlement.transactions.map((tx, idx) => (
                        <div key={idx} className="text-sm text-gray-600 pl-4">
                          {friendGroup.find(u => u.id === tx.from)?.name} owes {' '}
                          {friendGroup.find(u => u.id === tx.to)?.name} ${tx.amount.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </TabLayout>
  );
}
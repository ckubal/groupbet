'use client';

import React, { useState, useEffect } from 'react';
import KalshiComparisonPanel from './KalshiComparisonPanel';

interface ExperimentalPanelProps {
  week: number;
}

interface ComparisonData {
  game: {
    id: string;
    awayTeam: string;
    homeTeam: string;
    gameTime: string;
  };
  moneylines: Array<any>;
  spreads: Array<any>;
  overUnders: Array<any>;
  arbitrageOpportunities: Array<any>;
}

export default function ExperimentalPanel({ week }: ExperimentalPanelProps) {
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arbitrageOpportunities, setArbitrageOpportunities] = useState<any[]>([]);

  useEffect(() => {
    loadComparisons();
  }, [week]);

  const loadComparisons = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch comparison data
      const compareResponse = await fetch(`/api/kalshi/compare?week=${week}`);
      if (!compareResponse.ok) {
        throw new Error('Failed to fetch comparisons');
      }
      const compareData = await compareResponse.json();

      if (compareData.success) {
        setComparisons(compareData.comparisons || []);
      } else {
        throw new Error(compareData.error || 'Failed to load comparisons');
      }

      // Fetch arbitrage opportunities
      const arbitrageResponse = await fetch(`/api/kalshi/arbitrage?week=${week}&minProfit=0.5`);
      if (arbitrageResponse.ok) {
        const arbitrageData = await arbitrageResponse.json();
        if (arbitrageData.success) {
          setArbitrageOpportunities(arbitrageData.opportunities || []);
        }
      }
    } catch (err) {
      console.error('Error loading Kalshi comparisons:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Kalshi vs Bovada Comparison</h2>
        <p className="text-gray-400 text-sm">
          Compare prediction markets and betting lines to find arbitrage opportunities and value bets
        </p>
      </div>

      {/* Arbitrage Summary */}
      {arbitrageOpportunities.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
          <div className="font-semibold text-green-400 mb-2">
            💰 {arbitrageOpportunities.length} Arbitrage Opportunity{arbitrageOpportunities.length !== 1 ? 'ies' : ''} Found
          </div>
          <div className="text-sm text-gray-300 space-y-1">
            {arbitrageOpportunities.slice(0, 3).map((opp, idx) => (
              <div key={idx}>
                {opp.game.awayTeam} @ {opp.game.homeTeam}: {opp.profitMargin.toFixed(2)}% profit
                {' '}(${opp.guaranteedProfit.toFixed(2)} guaranteed)
              </div>
            ))}
            {arbitrageOpportunities.length > 3 && (
              <div className="text-gray-400 italic">
                +{arbitrageOpportunities.length - 3} more opportunities
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison Panel */}
      <KalshiComparisonPanel
        comparisons={comparisons}
        isLoading={isLoading}
        error={error}
      />

      {/* Refresh Button */}
      {!isLoading && (
        <div className="flex justify-center">
          <button
            onClick={loadComparisons}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Refresh Data
          </button>
        </div>
      )}
    </div>
  );
}

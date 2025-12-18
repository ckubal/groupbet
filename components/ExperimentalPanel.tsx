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
      console.log(`🔍 Loading Kalshi comparisons for Week ${week}...`);
      
      // Fetch comparison data
      const compareResponse = await fetch(`/api/kalshi/compare?week=${week}`);
      if (!compareResponse.ok) {
        const errorText = await compareResponse.text();
        console.error(`❌ Compare API error: ${compareResponse.status}`, errorText);
        throw new Error(`Failed to fetch comparisons: ${compareResponse.status} ${compareResponse.statusText}`);
      }
      const compareData = await compareResponse.json();

      console.log(`📊 Compare API response:`, {
        success: compareData.success,
        comparisonsCount: compareData.comparisons?.length || 0,
        totalGames: compareData.totalGames,
        matchedGames: compareData.matchedGames,
      });

      if (compareData.success) {
        setComparisons(compareData.comparisons || []);
        
        // Log debug information
        if (compareData.debug) {
          console.log(`🔍 Debug info:`, compareData.debug);
        }
        
        if (compareData.comparisons?.length === 0) {
          const debugMsg = compareData.debug 
            ? `Debug: ${compareData.debug.rawMarketsCount} raw markets, ${compareData.debug.processedMarketsCount} processed, ${compareData.debug.matchedGroupsCount} matched`
            : 'No debug info available';
          console.warn(`⚠️ No comparisons found. ${debugMsg}`);
          
          // Show more helpful error message
          if (compareData.debug?.rawMarketsCount === 0) {
            setError('No Kalshi markets found. This could mean markets are not yet available for this week, or the series ticker needs to be discovered.');
          } else if (compareData.debug?.processedMarketsCount === 0) {
            setError('Kalshi markets found but could not be processed. Market titles may use different formats.');
          } else if (compareData.debug?.matchedGroupsCount === 0) {
            setError('Kalshi markets found but could not be matched to games. Matching logic may need improvement.');
          }
        }
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

      {/* Link to Historical Over/Under Analysis */}
      <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-blue-400 mb-1">
              📊 Historical Over/Under Analysis
            </div>
            <div className="text-sm text-gray-300">
              Analyze historical betting odds vs actual outcomes to discover predictive patterns
            </div>
          </div>
          <a
            href="/exp2"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Open Analysis →
          </a>
        </div>
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

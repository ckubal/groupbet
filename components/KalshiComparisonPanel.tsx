'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { formatOdds } from '@/lib/betting-odds';

interface ComparisonData {
  game: {
    id: string;
    awayTeam: string;
    homeTeam: string;
    gameTime: string;
  };
  moneylines: Array<{
    kalshi?: { yesOdds: number; noOdds: number; teamName?: string };
    bovada?: { homeOdds: number; awayOdds: number };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    priceDifference: number;
    valueBet?: { platform: 'kalshi' | 'bovada'; expectedValue: number; recommendation: string };
  }>;
  spreads: Array<{
    kalshi?: { line: number; odds: number };
    bovada?: { line: number; odds: number };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    lineDifference: number;
    priceDifference: number;
  }>;
  overUnders: Array<{
    kalshi?: { line: number; overOdds: number; underOdds: number };
    bovada?: { line: number; overOdds: number; underOdds: number };
    betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
    lineDifference: number;
    priceDifference: number;
  }>;
  arbitrageOpportunities: Array<{
    marketType: string;
    profitMargin: number;
    guaranteedProfit: number;
  }>;
}

interface KalshiComparisonPanelProps {
  comparisons: ComparisonData[];
  isLoading?: boolean;
  error?: string | null;
}

export default function KalshiComparisonPanel({ 
  comparisons, 
  isLoading, 
  error 
}: KalshiComparisonPanelProps) {
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  const toggleGame = (gameId: string) => {
    const newExpanded = new Set(expandedGames);
    if (newExpanded.has(gameId)) {
      newExpanded.delete(gameId);
    } else {
      newExpanded.add(gameId);
    }
    setExpandedGames(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading Kalshi vs Bovada comparisons...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
        <p className="font-semibold">Error loading comparisons</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        <p>No comparisons available for this week.</p>
        <p className="text-sm mt-2">Kalshi markets may not be available yet, or games may not be matched.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comparisons.map((comparison) => {
        const isExpanded = expandedGames.has(comparison.game.id);
        const hasArbitrage = comparison.arbitrageOpportunities.length > 0;

        return (
          <div
            key={comparison.game.id}
            className={`bg-gray-800 rounded-lg border ${
              hasArbitrage 
                ? 'border-green-500/50 bg-green-900/10' 
                : 'border-gray-700'
            }`}
          >
            {/* Game Header */}
            <button
              onClick={() => toggleGame(comparison.game.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-semibold text-white">
                    {comparison.game.awayTeam} @ {comparison.game.homeTeam}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {format(new Date(comparison.game.gameTime), 'EEE, MMM d, h:mm a')}
                  </div>
                </div>
                {hasArbitrage && (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/50">
                    💰 Arbitrage Available
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  isExpanded ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-4 pt-0 border-t border-gray-700 space-y-4">
                {/* Arbitrage Opportunities */}
                {hasArbitrage && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <div className="font-semibold text-green-400 mb-2">💰 Arbitrage Opportunities</div>
                    {comparison.arbitrageOpportunities.map((opp, idx) => (
                      <div key={idx} className="text-sm text-gray-300">
                        <span className="capitalize">{opp.marketType}</span>: {opp.profitMargin.toFixed(2)}% profit margin
                        {' '}(Guaranteed profit: ${opp.guaranteedProfit.toFixed(2)})
                      </div>
                    ))}
                  </div>
                )}

                {/* Moneylines */}
                {comparison.moneylines.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-300 mb-2">Moneyline</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-1">Kalshi</div>
                        {comparison.moneylines[0].kalshi ? (
                          <div className="space-y-1">
                            <div>Yes: {formatOdds(comparison.moneylines[0].kalshi.yesOdds)}</div>
                            <div>No: {formatOdds(comparison.moneylines[0].kalshi.noOdds)}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">Bovada</div>
                        {comparison.moneylines[0].bovada ? (
                          <div className="space-y-1">
                            <div>Home: {formatOdds(comparison.moneylines[0].bovada.homeOdds)}</div>
                            <div>Away: {formatOdds(comparison.moneylines[0].bovada.awayOdds)}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                    </div>
                    {comparison.moneylines[0].betterPlatform !== 'unknown' && (
                      <div className="mt-2 text-xs">
                        <span className={`font-semibold ${
                          comparison.moneylines[0].betterPlatform === 'kalshi' ? 'text-green-400' :
                          comparison.moneylines[0].betterPlatform === 'bovada' ? 'text-blue-400' :
                          'text-gray-400'
                        }`}>
                          Better: {comparison.moneylines[0].betterPlatform}
                        </span>
                        {' '}({comparison.moneylines[0].priceDifference.toFixed(2)}% difference)
                      </div>
                    )}
                    {comparison.moneylines[0].valueBet && (
                      <div className="mt-2 text-xs text-yellow-400">
                        {comparison.moneylines[0].valueBet.recommendation}
                      </div>
                    )}
                  </div>
                )}

                {/* Spreads */}
                {comparison.spreads.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-300 mb-2">Spread</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-1">Kalshi</div>
                        {comparison.spreads[0].kalshi ? (
                          <div>
                            {comparison.spreads[0].kalshi.line > 0 ? '+' : ''}
                            {comparison.spreads[0].kalshi.line} ({formatOdds(comparison.spreads[0].kalshi.odds)})
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">Bovada</div>
                        {comparison.spreads[0].bovada ? (
                          <div>
                            {comparison.spreads[0].bovada.line > 0 ? '+' : ''}
                            {comparison.spreads[0].bovada.line} ({formatOdds(comparison.spreads[0].bovada.odds)})
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                    </div>
                    {comparison.spreads[0].lineDifference !== 0 && (
                      <div className="mt-2 text-xs text-yellow-400">
                        Line difference: {comparison.spreads[0].lineDifference > 0 ? '+' : ''}
                        {comparison.spreads[0].lineDifference.toFixed(1)} points
                      </div>
                    )}
                  </div>
                )}

                {/* Over/Unders */}
                {comparison.overUnders.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-300 mb-2">Over/Under</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-1">Kalshi</div>
                        {comparison.overUnders[0].kalshi ? (
                          <div className="space-y-1">
                            <div>Line: {comparison.overUnders[0].kalshi.line}</div>
                            <div>Over: {formatOdds(comparison.overUnders[0].kalshi.overOdds)}</div>
                            <div>Under: {formatOdds(comparison.overUnders[0].kalshi.underOdds)}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">Bovada</div>
                        {comparison.overUnders[0].bovada ? (
                          <div className="space-y-1">
                            <div>Line: {comparison.overUnders[0].bovada.line}</div>
                            <div>Over: {formatOdds(comparison.overUnders[0].bovada.overOdds)}</div>
                            <div>Under: {formatOdds(comparison.overUnders[0].bovada.underOdds)}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500">N/A</div>
                        )}
                      </div>
                    </div>
                    {comparison.overUnders[0].lineDifference !== 0 && (
                      <div className="mt-2 text-xs text-yellow-400">
                        Line difference: {comparison.overUnders[0].lineDifference > 0 ? '+' : ''}
                        {comparison.overUnders[0].lineDifference.toFixed(1)} points
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

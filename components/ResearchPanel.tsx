'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/lib/user-context';
import { useGroup } from '@/lib/group-context';
import { format } from 'date-fns';

interface TeamStats {
  teamName: string;
  games: Array<{
    week: number;
    opponent: string;
    pointsScored: number;
    pointsAllowed: number;
    isHome: boolean;
  }>;
  avgPointsScored: number;
  avgPointsAllowed: number;
  medianPointsScored: number;
  medianPointsAllowed: number;
}

interface GameAnalysis {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  bovadaOverUnder?: number;
  spread?: number;
  spreadOdds?: number;
  awayMoneyline?: number;
  homeMoneyline?: number;
  awayTeamStats: TeamStats;
  homeTeamStats: TeamStats;
  projectedTotal: number;
  projectedAwayScore?: number;
  projectedHomeScore?: number;
  difference: number;
  recommendation: 'over' | 'under' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  adjustments?: string[];
  gameContext?: string[];
}

interface ResearchData {
  week: number;
  analyzedAt: string;
  games: GameAnalysis[];
  summary: {
    totalGames: number;
    gamesWithLines: number;
    highConfidenceBets: number;
    mediumConfidenceBets: number;
  };
}

interface PlacedBet {
  gameKey: string;
  bet: 'over' | 'under';
  line: number;
  placedAt: string;
}

interface PredictionRecords {
  high: { correct: number; incorrect: number; total: number; percentage: number };
  medium: { correct: number; incorrect: number; total: number; percentage: number };
  low: { correct: number; incorrect: number; total: number; percentage: number };
  overall: { correct: number; incorrect: number; total: number; percentage: number };
  predictions: Array<{
    gameId: string;
    awayTeam: string;
    homeTeam: string;
    recommendation: string;
    confidence: string;
    projectedTotal: number;
    bovadaOverUnder?: number;
    actualTotal?: number;
    isCorrect?: boolean;
  }>;
}

interface ResearchPanelProps {
  week: number;
  onPlaceBet: (analysis: GameAnalysis) => void;
}

export default function ResearchPanel({ week, onPlaceBet }: ResearchPanelProps) {
  const { currentUser } = useUser();
  const { groupSession } = useGroup();
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [placedBets, setPlacedBets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [predictionRecords, setPredictionRecords] = useState<PredictionRecords | null>(null);

  useEffect(() => {
    loadResearchData();
    loadPlacedBets();
    loadPredictionRecords();
  }, [week, currentUser, groupSession]);

  const loadPredictionRecords = async () => {
    try {
      const response = await fetch(`/api/prediction-records?week=${week}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.records) {
          setPredictionRecords(data.records);
        }
      }
    } catch (err) {
      console.warn('Could not load prediction records:', err);
    }
  };

  const loadResearchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyze-over-under?week=${week}`);
      if (!response.ok) {
        throw new Error('Failed to load research data');
      }
      const data = await response.json();
      setResearchData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load research');
      console.error('Error loading research:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlacedBets = async () => {
    if (!currentUser || !groupSession) return;
    
    try {
      const weekendId = `2025-week-${week}`;
      const response = await fetch(`/api/research-bets?weekendId=${weekendId}&userId=${currentUser.id}`);
      if (response.ok) {
        const data = await response.json();
        const betKeys = new Set<string>(data.bets.map((b: PlacedBet) => `${b.gameKey}-${b.bet}`));
        setPlacedBets(betKeys);
      }
    } catch (err) {
      console.error('Error loading placed bets:', err);
    }
  };

  const markBetPlaced = async (analysis: GameAnalysis, bet: 'over' | 'under') => {
    if (!currentUser || !groupSession) return;

    const gameKey = `${analysis.awayTeam}-${analysis.homeTeam}`;
    const betKey = `${gameKey}-${bet}`;

    try {
      const weekendId = `2025-week-${week}`;
      const response = await fetch('/api/research-bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekendId,
          userId: currentUser.id,
          gameKey,
          bet,
          line: analysis.bovadaOverUnder,
        }),
      });

      if (response.ok) {
        setPlacedBets(prev => new Set([...prev, betKey]));
      }
    } catch (err) {
      console.error('Error marking bet as placed:', err);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 border-green-300';
      case 'medium': return 'bg-yellow-100 border-yellow-300';
      case 'low': return 'bg-gray-100 border-gray-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };


  const getConfidenceEmoji = (confidence: string) => {
    switch (confidence) {
      case 'high': return '🟢';
      case 'medium': return '🟡';
      case 'low': return '🔴';
      default: return '⚪';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading research analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadResearchData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!researchData) {
    return (
      <div className="p-8 text-center text-gray-600">
        No research data available for Week {week}
      </div>
    );
  }

  // Sort games by confidence (high, medium, low) then by absolute difference
  const sortedGames = [...researchData.games].sort((a, b) => {
    // First sort by confidence
    const order = { high: 0, medium: 1, low: 2, neutral: 3 };
    const aOrder = order[a.confidence as keyof typeof order] ?? 3;
    const bOrder = order[b.confidence as keyof typeof order] ?? 3;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    // Then by absolute difference (larger differences first)
    return Math.abs(b.difference) - Math.abs(a.difference);
  });

  // Group by confidence - show ALL games, not just those with lines
  const highConfidence = sortedGames.filter(g => g.confidence === 'high');
  const mediumConfidence = sortedGames.filter(g => g.confidence === 'medium');
  const lowConfidence = sortedGames.filter(g => g.confidence === 'low');
  
  // Games without lines (for reference)
  const gamesWithoutLines = sortedGames.filter(g => !g.bovadaOverUnder);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">O/U Research - Week {week}</h2>
        <p className="text-xs text-gray-500 mt-1">
          Updated: {format(new Date(researchData.analyzedAt), 'MMM d, yyyy h:mm a')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-600 font-medium">Total Games</div>
          <div className="text-2xl font-bold text-blue-900">{researchData.summary.totalGames}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-600 font-medium">High Confidence</div>
          <div className="text-2xl font-bold text-green-900">{researchData.summary.highConfidenceBets}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600 font-medium">Medium Confidence</div>
          <div className="text-2xl font-bold text-yellow-900">{researchData.summary.mediumConfidenceBets}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 font-medium">Games w/ Lines</div>
          <div className="text-2xl font-bold text-gray-900">{researchData.summary.gamesWithLines}</div>
        </div>
      </div>

      {/* Prediction Records */}
      {predictionRecords && predictionRecords.overall.total > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-2 border-purple-200">
          <h3 className="text-xl font-bold mb-4">📊 Prediction Record - Week {week}</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-purple-200">
              <div className="text-sm font-medium text-gray-600 mb-1">High Confidence</div>
              <div className="text-2xl font-bold text-purple-900">
                {predictionRecords.high.correct}-{predictionRecords.high.incorrect}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {predictionRecords.high.total} total • {predictionRecords.high.percentage}%
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-yellow-200">
              <div className="text-sm font-medium text-gray-600 mb-1">Medium Confidence</div>
              <div className="text-2xl font-bold text-yellow-900">
                {predictionRecords.medium.correct}-{predictionRecords.medium.incorrect}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {predictionRecords.medium.total} total • {predictionRecords.medium.percentage}%
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-red-200">
              <div className="text-sm font-medium text-gray-600 mb-1">Low Confidence</div>
              <div className="text-2xl font-bold text-red-900">
                {predictionRecords.low.correct}-{predictionRecords.low.incorrect}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {predictionRecords.low.total} total • {predictionRecords.low.percentage}%
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
              <div className="text-sm font-medium text-gray-600 mb-1">Overall</div>
              <div className="text-2xl font-bold text-blue-900">
                {predictionRecords.overall.correct}-{predictionRecords.overall.incorrect}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {predictionRecords.overall.total} total • {predictionRecords.overall.percentage}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High Confidence Bets */}
      {highConfidence.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🟢 High Confidence Bets</span>
            <span className="text-sm font-normal text-gray-600">({highConfidence.length})</span>
          </h3>
          <div className="space-y-4">
            {highConfidence.map((analysis, idx) => (
              <GameAnalysisCard
                key={idx}
                analysis={analysis}
                placedBets={placedBets}
                onMarkBetPlaced={markBetPlaced}
                onPlaceBet={onPlaceBet}
                getConfidenceColor={getConfidenceColor}
                getConfidenceEmoji={getConfidenceEmoji}
              />
            ))}
          </div>
        </div>
      )}

      {/* Medium Confidence Bets */}
      {mediumConfidence.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🟡 Medium Confidence Bets</span>
            <span className="text-sm font-normal text-gray-600">({mediumConfidence.length})</span>
          </h3>
          <div className="space-y-4">
            {mediumConfidence.map((analysis, idx) => (
              <GameAnalysisCard
                key={idx}
                analysis={analysis}
                placedBets={placedBets}
                onMarkBetPlaced={markBetPlaced}
                onPlaceBet={onPlaceBet}
                getConfidenceColor={getConfidenceColor}
                getConfidenceEmoji={getConfidenceEmoji}
              />
            ))}
          </div>
        </div>
      )}

      {/* Low Confidence Bets */}
      {lowConfidence.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔴 Low Confidence Bets</span>
            <span className="text-sm font-normal text-gray-600">({lowConfidence.length})</span>
          </h3>
          <div className="space-y-4">
            {lowConfidence.map((analysis, idx) => (
              <GameAnalysisCard
                key={idx}
                analysis={analysis}
                placedBets={placedBets}
                onMarkBetPlaced={markBetPlaced}
                onPlaceBet={onPlaceBet}
                getConfidenceColor={getConfidenceColor}
                getConfidenceEmoji={getConfidenceEmoji}
              />
            ))}
          </div>
        </div>
      )}

      {/* Games Without Betting Lines */}
      {gamesWithoutLines.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚪ Games Without Betting Lines</span>
            <span className="text-sm font-normal text-gray-600">({gamesWithoutLines.length})</span>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            These games don't have betting lines available (may be completed or lines not yet posted). Projections shown for reference.
          </p>
          <div className="space-y-4">
            {gamesWithoutLines.map((analysis, idx) => (
              <GameAnalysisCard
                key={idx}
                analysis={analysis}
                placedBets={placedBets}
                onMarkBetPlaced={markBetPlaced}
                onPlaceBet={onPlaceBet}
                getConfidenceColor={getConfidenceColor}
                getConfidenceEmoji={getConfidenceEmoji}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GameAnalysisCard({
  analysis,
  placedBets,
  onMarkBetPlaced,
  onPlaceBet,
  getConfidenceColor,
  getConfidenceEmoji,
}: {
  analysis: GameAnalysis;
  placedBets: Set<string>;
  onMarkBetPlaced: (analysis: GameAnalysis, bet: 'over' | 'under') => Promise<void>;
  onPlaceBet: (analysis: GameAnalysis) => void;
  getConfidenceColor: (conf: string) => string;
  getConfidenceEmoji: (conf: string) => string;
}) {
  const gameKey = `${analysis.awayTeam}-${analysis.homeTeam}`;
  const overKey = `${gameKey}-over`;
  const underKey = `${gameKey}-under`;
  const isOverPlaced = placedBets.has(overKey);
  const isUnderPlaced = placedBets.has(underKey);
  const hasLine = analysis.bovadaOverUnder !== undefined;

  return (
    <div className={`border-2 rounded-lg p-5 ${getConfidenceColor(analysis.confidence)}`}>
      {/* Header: Team Matchup (Secondary) */}
      <div className="mb-4">
        <h4 className="font-semibold text-base text-gray-700">
          {analysis.awayTeam} @ {analysis.homeTeam}
        </h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {format(new Date(analysis.gameTime), 'MMM d, h:mm a')}
        </p>
      </div>

      {/* Primary: O/U Calculation, Difference, Recommendation */}
      <div className="bg-white rounded-lg p-5 mb-4 border border-gray-200">
        {/* Core Calculation - Single Clear Display */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Projected Total</div>
            <div className="text-3xl font-bold text-gray-900">{analysis.projectedTotal.toFixed(1)}</div>
          </div>
          {hasLine && (
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Bovada Line</div>
              <div className="text-2xl font-semibold text-gray-700">{analysis.bovadaOverUnder}</div>
            </div>
          )}
        </div>

        {/* Difference - Single Clear Display */}
        {hasLine && (
          <div className="border-t border-gray-200 pt-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Difference</span>
              <span className={`text-xl font-bold ${
                Math.abs(analysis.difference) >= 3 
                  ? 'text-green-600' 
                  : Math.abs(analysis.difference) >= 2 
                  ? 'text-yellow-600' 
                  : 'text-gray-600'
              }`}>
                {analysis.difference > 0 ? '+' : ''}{analysis.difference.toFixed(1)} points
              </span>
            </div>
          </div>
        )}

        {/* Team Predictions with Bovada Comparison */}
        {(analysis.projectedAwayScore !== undefined || analysis.projectedHomeScore !== undefined) && (
          <div className="border-t border-gray-200 pt-4 mb-4">
            <div className="text-xs text-gray-500 mb-3 font-medium">Team Predictions</div>
            
            {/* Away Team */}
            {analysis.projectedAwayScore !== undefined && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-base text-gray-900">{analysis.awayTeam}</div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{analysis.projectedAwayScore.toFixed(1)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Predicted</div>
                  </div>
                </div>
                
                {/* Bovada Lines - Clearer Layout */}
                <div className="bg-gray-50 rounded p-3 space-y-2">
                  {analysis.spread !== undefined && analysis.spread > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Spread</div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">+{analysis.spread}</span>
                        {analysis.spreadOdds && (
                          <span className="text-sm text-gray-600">({analysis.spreadOdds > 0 ? '+' : ''}{analysis.spreadOdds})</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {analysis.awayMoneyline !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Moneyline</div>
                      <span className="text-sm font-bold text-gray-900">{analysis.awayMoneyline > 0 ? '+' : ''}{analysis.awayMoneyline}</span>
                    </div>
                  )}
                  
                  {analysis.projectedHomeScore !== undefined && analysis.spread !== undefined && analysis.spread > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600">Predicted Margin</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            (analysis.projectedAwayScore - analysis.projectedHomeScore) > analysis.spread 
                              ? 'text-green-600' 
                              : (analysis.projectedAwayScore - analysis.projectedHomeScore) < analysis.spread
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}>
                            {(analysis.projectedAwayScore - analysis.projectedHomeScore) > 0 ? '+' : ''}
                            {(analysis.projectedAwayScore - analysis.projectedHomeScore).toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500">vs +{analysis.spread}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Home Team */}
            {analysis.projectedHomeScore !== undefined && (
              <div className="mb-4 pb-4 border-b border-gray-200 last:border-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-base text-gray-900">{analysis.homeTeam}</div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">{analysis.projectedHomeScore.toFixed(1)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Predicted</div>
                  </div>
                </div>
                
                {/* Bovada Lines - Clearer Layout */}
                <div className="bg-gray-50 rounded p-3 space-y-2">
                  {analysis.spread !== undefined && analysis.spread < 0 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Spread</div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">{analysis.spread}</span>
                        {analysis.spreadOdds && (
                          <span className="text-sm text-gray-600">({analysis.spreadOdds > 0 ? '+' : ''}{analysis.spreadOdds})</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {analysis.homeMoneyline !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Moneyline</div>
                      <span className="text-sm font-bold text-gray-900">{analysis.homeMoneyline > 0 ? '+' : ''}{analysis.homeMoneyline}</span>
                    </div>
                  )}
                  
                  {analysis.projectedAwayScore !== undefined && analysis.spread !== undefined && analysis.spread < 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600">Predicted Margin</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            (analysis.projectedHomeScore - analysis.projectedAwayScore) > Math.abs(analysis.spread)
                              ? 'text-green-600' 
                              : (analysis.projectedHomeScore - analysis.projectedAwayScore) < Math.abs(analysis.spread)
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}>
                            {(analysis.projectedHomeScore - analysis.projectedAwayScore) > 0 ? '+' : ''}
                            {(analysis.projectedHomeScore - analysis.projectedAwayScore).toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500">vs {analysis.spread}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendation - Single Clear Display */}
        {hasLine && analysis.recommendation !== 'neutral' && (
          <div className="border-t border-gray-200 pt-4">
            <div className="text-xs text-gray-500 mb-2">Recommendation</div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900">
                {analysis.recommendation.toUpperCase()} {analysis.bovadaOverUnder}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await onMarkBetPlaced(analysis, 'over');
                    onPlaceBet(analysis);
                  }}
                  disabled={isOverPlaced}
                  className={`px-4 py-2 rounded font-medium transition-colors text-sm ${
                    isOverPlaced
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : analysis.recommendation === 'over'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {isOverPlaced ? '✓ Placed' : 'Place OVER'}
                </button>
                <button
                  onClick={async () => {
                    await onMarkBetPlaced(analysis, 'under');
                    onPlaceBet(analysis);
                  }}
                  disabled={isUnderPlaced}
                  className={`px-4 py-2 rounded font-medium transition-colors text-sm ${
                    isUnderPlaced
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : analysis.recommendation === 'under'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {isUnderPlaced ? '✓ Placed' : 'Place UNDER'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alpha Test Disclaimer - Subtle */}
        <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
          <p className="text-xs text-gray-400 italic">
            ⚠️ Alpha Test: Experimental predictions. Use at your own discretion.
          </p>
        </div>
      </div>

      {/* Game Context & Adjustments - Show context with point effects */}
      {(analysis.gameContext && analysis.gameContext.length > 0) || (analysis.adjustments && analysis.adjustments.length > 0) ? (
        <div className="bg-white/50 rounded-lg p-3 mb-2 border border-gray-200">
          <div className="text-xs font-medium text-gray-600 mb-2">Game Context & Effects</div>
          
          {/* Match game context with adjustments */}
          {analysis.gameContext && analysis.gameContext.map((context, idx) => {
            // Find matching adjustment for this context
            let matchingAdjustment: string | null = null;
            let pointEffect: string | null = null;
            
            if (analysis.adjustments) {
              // Match context to adjustments
              if (context.includes('Thursday Night')) {
                const adj = analysis.adjustments.find(a => a.includes('Thursday Night'));
                if (adj) {
                  matchingAdjustment = adj;
                  const match = adj.match(/([+-]?\d+\.?\d*)/);
                  if (match) pointEffect = match[1];
                }
              } else if (context.includes('Monday Night')) {
                const adj = analysis.adjustments.find(a => a.includes('Monday Night'));
                if (adj) {
                  matchingAdjustment = adj;
                  const match = adj.match(/([+-]?\d+\.?\d*)/);
                  if (match) pointEffect = match[1];
                }
              } else if (context.includes('Sunday Night')) {
                // Sunday Night Football typically has no adjustment, but check anyway
                const adj = analysis.adjustments.find(a => a.includes('Sunday Night'));
                if (adj) {
                  matchingAdjustment = adj;
                  const match = adj.match(/([+-]?\d+\.?\d*)/);
                  if (match) pointEffect = match[1];
                }
              }
            }
            
            return (
              <div key={idx} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{context}</span>
                  {pointEffect && (
                    <span className={`text-xs font-bold ${
                      parseFloat(pointEffect) < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {parseFloat(pointEffect) > 0 ? '+' : ''}{pointEffect} pts
                    </span>
                  )}
                  {!pointEffect && (
                    <span className="text-xs text-gray-400">No adjustment</span>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Show other adjustments that don't match context */}
          {analysis.adjustments && analysis.adjustments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              {analysis.adjustments
                .filter(adj => {
                  // Filter out adjustments already shown in context
                  return !adj.includes('Thursday Night') && 
                         !adj.includes('Monday Night') && 
                         !adj.includes('Sunday Night');
                })
                .map((adj, idx) => {
                  const match = adj.match(/([+-]?\d+\.?\d*)/);
                  const pointEffect = match ? match[1] : null;
                  const reason = adj.split(':')[0] || adj;
                  
                  return (
                    <div key={idx} className="mb-1 last:mb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{reason}</span>
                        {pointEffect && (
                          <span className={`text-xs font-bold ${
                            parseFloat(pointEffect) < 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {parseFloat(pointEffect) > 0 ? '+' : ''}{pointEffect} pts
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : null}

      {!hasLine && (
        <div className="text-center text-gray-500 text-sm py-2 bg-white rounded p-3">
          No betting line available
        </div>
      )}
    </div>
  );
}

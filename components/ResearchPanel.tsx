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
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
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
    <div className={`border rounded-lg p-4 ${getConfidenceColor(analysis.confidence)}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-lg">
            {analysis.awayTeam} @ {analysis.homeTeam}
          </h4>
          <p className="text-sm text-gray-600">
            {format(new Date(analysis.gameTime), 'MMM d, h:mm a')}
          </p>
        </div>
        <div className="text-right">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(analysis.confidence)}`}>
            {getConfidenceEmoji(analysis.confidence)} {analysis.confidence.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Projection and Betting Lines */}
      <div className="bg-white rounded p-4 mb-4">
        {/* Projected Total */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-1">Projected Total</div>
          <div className="text-2xl font-bold">{analysis.projectedTotal.toFixed(1)}</div>
          {hasLine && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">vs Bovada:</span>
              <span className="text-lg font-semibold">{analysis.bovadaOverUnder}</span>
              <span className={`text-sm font-medium ${Math.abs(analysis.difference) >= 3 ? 'text-green-600 font-bold' : analysis.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({analysis.difference > 0 ? '+' : ''}{analysis.difference.toFixed(1)})
              </span>
            </div>
          )}
        </div>

        {/* Betting Lines and Predicted Score Combined */}
        <div className="border-t pt-4">
          <div className="space-y-3">
            {/* Away Team */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{analysis.awayTeam}</div>
                <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
                  {hasLine && analysis.bovadaOverUnder && (
                    <span className="text-gray-600">O/U: <span className="font-medium">{analysis.bovadaOverUnder}</span></span>
                  )}
                  {analysis.spread !== undefined && analysis.spread > 0 && (
                    <span className="text-gray-600">Spread: <span className="font-medium">+{analysis.spread}</span></span>
                  )}
                  {analysis.awayMoneyline !== undefined && (
                    <span className="text-gray-600">ML: <span className="font-medium">{analysis.awayMoneyline > 0 ? '+' : ''}{analysis.awayMoneyline}</span></span>
                  )}
                </div>
              </div>
              {analysis.projectedAwayScore !== undefined && (
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Predicted</div>
                  <div className="text-xl font-bold text-blue-600">{analysis.projectedAwayScore.toFixed(1)}</div>
                </div>
              )}
            </div>

            {/* Home Team */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{analysis.homeTeam}</div>
                <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
                  {hasLine && analysis.bovadaOverUnder && (
                    <span className="text-gray-600">O/U: <span className="font-medium">{analysis.bovadaOverUnder}</span></span>
                  )}
                  {analysis.spread !== undefined && analysis.spread < 0 && (
                    <span className="text-gray-600">Spread: <span className="font-medium">{analysis.spread}</span></span>
                  )}
                  {analysis.homeMoneyline !== undefined && (
                    <span className="text-gray-600">ML: <span className="font-medium">{analysis.homeMoneyline > 0 ? '+' : ''}{analysis.homeMoneyline}</span></span>
                  )}
                </div>
              </div>
              {analysis.projectedHomeScore !== undefined && (
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Predicted</div>
                  <div className="text-xl font-bold text-red-600">{analysis.projectedHomeScore.toFixed(1)}</div>
                </div>
              )}
            </div>

            {/* Predicted Total and Recommendation */}
            {analysis.projectedAwayScore !== undefined && analysis.projectedHomeScore !== undefined && (
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Predicted Total</div>
                    <div className="text-lg font-bold text-gray-800">
                      {(analysis.projectedAwayScore + analysis.projectedHomeScore).toFixed(1)}
                    </div>
                  </div>
                  {hasLine && analysis.bovadaOverUnder && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">Delta</div>
                      <div className={`text-lg font-bold ${
                        Math.abs(analysis.difference) >= 3 
                          ? 'text-green-600' 
                          : Math.abs(analysis.difference) >= 2 
                          ? 'text-yellow-600' 
                          : 'text-gray-600'
                      }`}>
                        {analysis.difference > 0 ? '+' : ''}{analysis.difference.toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Recommendation based on predicted score */}
                {hasLine && analysis.bovadaOverUnder && analysis.projectedAwayScore !== undefined && analysis.projectedHomeScore !== undefined && (
                  <div className={`mt-2 p-2 rounded ${
                    Math.abs(analysis.difference) >= 3 
                      ? 'bg-green-50 border border-green-200' 
                      : Math.abs(analysis.difference) >= 2 
                      ? 'bg-yellow-50 border border-yellow-200' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      {Math.abs(analysis.difference) >= 3 ? '🎯 Strong Recommendation' : Math.abs(analysis.difference) >= 2 ? '💡 Consider' : '⚖️ Close Match'}
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      Predicted {analysis.difference > 0 ? 'OVER' : 'UNDER'} Bovada line by {Math.abs(analysis.difference).toFixed(1)} points
                    </div>
                  </div>
                )}

                {/* Alpha Test Disclaimer */}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                  <p className="text-xs text-gray-500 italic">
                    ⚠️ <strong>Alpha Test:</strong> Predicted scores are experimental and should not be considered reliable predictors. Use at your own discretion.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Context & Adjustments */}
      {(analysis.gameContext && analysis.gameContext.length > 0) || (analysis.adjustments && analysis.adjustments.length > 0) ? (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 mb-4 border border-gray-200">
          {analysis.gameContext && analysis.gameContext.length > 0 && (
            <div className="mb-3">
              <div className="text-gray-700 font-semibold mb-2 text-sm flex items-center gap-2">
                <span>📋</span>
                <span>Game Context</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.gameContext.map((context, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md text-xs font-medium shadow-sm">
                    {context}
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.adjustments && analysis.adjustments.length > 0 && (
            <div>
              <div className="text-gray-700 font-semibold mb-2 text-sm flex items-center gap-2">
                <span>📊</span>
                <span>Adjustments Applied</span>
              </div>
              <div className="space-y-1.5">
                {analysis.adjustments.map((adj, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700 bg-white rounded px-3 py-2 border border-gray-200">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span className="flex-1">{adj}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-500 text-center border border-gray-200">
          No adjustments or special context
        </div>
      )}

      {/* Recommendation & Actions */}
      {hasLine && analysis.recommendation !== 'neutral' && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">O/U Recommendation</div>
            <div className="text-lg font-bold">
              {analysis.recommendation.toUpperCase()} {analysis.bovadaOverUnder}
            </div>
            {Math.abs(analysis.difference) >= 3 && (
              <div className="text-xs text-green-600 font-medium mt-1">
                Strong signal: {Math.abs(analysis.difference).toFixed(1)} point difference
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await onMarkBetPlaced(analysis, 'over');
                onPlaceBet(analysis);
              }}
              disabled={isOverPlaced}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isOverPlaced
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : analysis.recommendation === 'over'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isOverPlaced ? '✓ OVER Placed' : 'Place OVER'}
            </button>
            <button
              onClick={async () => {
                await onMarkBetPlaced(analysis, 'under');
                onPlaceBet(analysis);
              }}
              disabled={isUnderPlaced}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isUnderPlaced
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : analysis.recommendation === 'under'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isUnderPlaced ? '✓ UNDER Placed' : 'Place UNDER'}
            </button>
          </div>
        </div>
      )}

      {!hasLine && (
        <div className="text-center text-gray-500 text-sm py-2">
          No betting line available
        </div>
      )}
    </div>
  );
}

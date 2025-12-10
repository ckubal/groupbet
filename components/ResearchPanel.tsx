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
  awayTeamStats: TeamStats;
  homeTeamStats: TeamStats;
  projectedTotal: number;
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

  useEffect(() => {
    loadResearchData();
    loadPlacedBets();
  }, [week, currentUser, groupSession]);

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
        <p className="text-sm text-gray-600">
          Analysis based on last 4 games (median scoring averages)
        </p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="text-gray-600">Away Team (Last 4 Games)</div>
          <div className="font-medium">
            Avg: {analysis.awayTeamStats.avgPointsScored.toFixed(1)} scored / {analysis.awayTeamStats.avgPointsAllowed.toFixed(1)} allowed
          </div>
          <div className="text-xs text-gray-500">
            Median: {analysis.awayTeamStats.medianPointsScored.toFixed(1)} / {analysis.awayTeamStats.medianPointsAllowed.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-gray-600">Home Team (Last 4 Games)</div>
          <div className="font-medium">
            Avg: {analysis.homeTeamStats.avgPointsScored.toFixed(1)} scored / {analysis.homeTeamStats.avgPointsAllowed.toFixed(1)} allowed
          </div>
          <div className="text-xs text-gray-500">
            Median: {analysis.homeTeamStats.medianPointsScored.toFixed(1)} / {analysis.homeTeamStats.medianPointsAllowed.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Projection */}
      <div className="bg-white rounded p-3 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-600">Projected Total</div>
            <div className="text-2xl font-bold">{analysis.projectedTotal.toFixed(1)}</div>
          </div>
          {hasLine && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Bovada Line</div>
              <div className="text-xl font-bold">{analysis.bovadaOverUnder}</div>
              <div className={`text-sm font-medium ${analysis.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysis.difference > 0 ? '+' : ''}{analysis.difference.toFixed(1)} edge
              </div>
            </div>
          )}
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
            <div className="text-sm text-gray-600">Recommendation</div>
            <div className="text-lg font-bold">
              {analysis.recommendation.toUpperCase()} {analysis.bovadaOverUnder}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await onMarkBetPlaced(analysis, 'over');
                onPlaceBet(analysis);
              }}
              disabled={isOverPlaced}
              className={`px-4 py-2 rounded font-medium ${
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
              className={`px-4 py-2 rounded font-medium ${
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

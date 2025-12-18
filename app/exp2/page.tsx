'use client';

import React, { useState, useEffect } from 'react';

interface GameAnalysis {
  gameId: string;
  readableId: string;
  espnId?: string;
  oddsApiId?: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  espnData: {
    awayScore: number;
    homeScore: number;
    totalScore: number;
  };
  historicalOdds: {
    overUnder: number;
    overUnderOdds: number;
    bookmaker: string;
    snapshotTimestamp: string;
  };
  result: {
    wentOver: boolean;
    wentUnder: boolean;
    margin: number;
    isPush: boolean;
  };
  context: {
    venue: {
      name: string;
      city: string;
      isIndoor: boolean;
    };
    weather?: {
      temperature?: number;
      condition?: string;
      windSpeed?: number;
      precipitation?: 'None' | 'Rain' | 'Snow' | 'Other';
    };
    timeSlot: string;
    isInternational: boolean;
    awayTeamRecord: {
      wins: number;
      losses: number;
      winPercentage: number;
      playoffStatus: string;
    };
    homeTeamRecord: {
      wins: number;
      losses: number;
      winPercentage: number;
      playoffStatus: string;
    };
    gameImportance: {
      playoffImplications: boolean;
      notes?: string;
    };
    restDays?: {
      awayTeam: number;
      homeTeam: number;
    };
    teamPerformance: {
      awayTeam: {
        rollingAverages: {
          last1Game: { pointsScored: number; pointsAllowed: number };
          last2Games: { pointsScored: number; pointsAllowed: number };
          last3Games: { pointsScored: number; pointsAllowed: number };
          last4Games: { pointsScored: number; pointsAllowed: number };
          last5Games: { pointsScored: number; pointsAllowed: number };
          last6Games: { pointsScored: number; pointsAllowed: number };
        };
        seasonAverages: {
          gamesPlayed: number;
          pointsScoredPerGame: number;
          pointsAllowedPerGame: number;
        };
        weightedAverages: {
          decayFactor: number;
          pointsScored: number;
          pointsAllowed: number;
        };
      };
      homeTeam: {
        rollingAverages: {
          last1Game: { pointsScored: number; pointsAllowed: number };
          last2Games: { pointsScored: number; pointsAllowed: number };
          last3Games: { pointsScored: number; pointsAllowed: number };
          last4Games: { pointsScored: number; pointsAllowed: number };
          last5Games: { pointsScored: number; pointsAllowed: number };
          last6Games: { pointsScored: number; pointsAllowed: number };
        };
        seasonAverages: {
          gamesPlayed: number;
          pointsScoredPerGame: number;
          pointsAllowedPerGame: number;
        };
        weightedAverages: {
          decayFactor: number;
          pointsScored: number;
          pointsAllowed: number;
        };
      };
      combinedMetrics: {
        expectedTotal_last4Games: number;
        expectedTotal_seasonAvg: number;
        expectedTotal_weighted: number;
      };
    };
  };
  matchConfidence: string;
}

interface AnalysisData {
  week: number;
  year: number;
  weekBoundaries: { start: string; end: string };
  cached: boolean;
  analyzedAt: string;
  totalEspnGames: number;
  totalHistoricalOddsGames: number;
  matchedGames: GameAnalysis[];
  unmatchedEspnGames: any[];
  unmatchedOddsGames: any[];
  summary: {
    totalGames: number;
    matchedGames: number;
    overCount: number;
    underCount: number;
    pushCount: number;
  };
}

export default function Exp2Page() {
  const [week, setWeek] = useState(10);
  const [year, setYear] = useState(2023);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameAnalysis | null>(null);

  useEffect(() => {
    loadData();
  }, [week, year]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setSelectedGame(null);

    try {
      const response = await fetch(`/api/analyze-historical-over-under?week=${week}&year=${year}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
      }

      const analysisData = await response.json();
      setData(analysisData);
    } catch (err) {
      console.error('Error loading analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getResultColor = (result: GameAnalysis['result']) => {
    if (result.isPush) return 'text-yellow-400';
    if (result.wentOver) return 'text-green-400';
    return 'text-red-400';
  };

  const getResultIcon = (result: GameAnalysis['result']) => {
    if (result.isPush) return '➖';
    if (result.wentOver) return '📈';
    return '📉';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Historical Over/Under Analysis</h1>
            <p className="text-gray-400">
              Analyze historical betting odds vs actual game outcomes to discover predictive patterns
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-gray-400">Year:</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || 2023)}
              className="bg-[#2a2a2a] border border-[#383838] rounded px-3 py-1 text-white w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400">Week:</label>
            <input
              type="number"
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value) || 10)}
              min="1"
              max="18"
              className="bg-[#2a2a2a] border border-[#383838] rounded px-3 py-1 text-white w-20"
            />
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load Analysis'}
          </button>
          {data?.cached && (
            <span className="text-sm text-gray-400">(Cached from Firebase)</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="text-red-400 font-semibold">Error</div>
            <div className="text-sm text-gray-300 mt-1">{error}</div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading analysis data...</div>
          </div>
        )}

        {/* Summary */}
        {data && !isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Total Games</div>
                <div className="text-2xl font-bold">{data.summary.totalGames}</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Matched</div>
                <div className="text-2xl font-bold text-blue-400">{data.summary.matchedGames}</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Over</div>
                <div className="text-2xl font-bold text-green-400">{data.summary.overCount}</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Under</div>
                <div className="text-2xl font-bold text-red-400">{data.summary.underCount}</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Push</div>
                <div className="text-2xl font-bold text-yellow-400">{data.summary.pushCount}</div>
              </div>
            </div>

            {/* Games Table */}
            <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#383838]">
                <h2 className="text-xl font-bold">Matched Games ({data.matchedGames.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2a2a2a]">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Game</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Score</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">O/U Line</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Result</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Margin</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Expected (Last 4)</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Expected (Season)</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Expected (Weighted)</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Weather</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matchedGames.map((game) => (
                      <tr
                        key={game.gameId}
                        className="border-t border-[#383838] hover:bg-[#2a2a2a] cursor-pointer"
                        onClick={() => setSelectedGame(game)}
                      >
                        <td className="p-3">
                          <div className="font-medium">
                            {game.awayTeam} @ {game.homeTeam}
                          </div>
                          <div className="text-xs text-gray-500">{formatDate(game.gameTime)}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono">
                            {game.espnData.awayScore}-{game.espnData.homeScore}
                          </div>
                          <div className="text-xs text-gray-500">Total: {game.espnData.totalScore}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono font-semibold">{game.historicalOdds.overUnder}</div>
                          <div className="text-xs text-gray-500">{game.historicalOdds.bookmaker}</div>
                        </td>
                        <td className="p-3">
                          <div className={`font-semibold ${getResultColor(game.result)}`}>
                            {getResultIcon(game.result)} {game.result.wentOver ? 'Over' : game.result.wentUnder ? 'Under' : 'Push'}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className={`font-mono ${Math.abs(game.result.margin) > 7 ? 'font-semibold' : ''}`}>
                            {game.result.margin > 0 ? '+' : ''}{game.result.margin.toFixed(1)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-sm">
                            {game.context.teamPerformance.combinedMetrics.expectedTotal_last4Games.toFixed(1)}
                          </div>
                          <div className={`text-xs ${Math.abs(game.context.teamPerformance.combinedMetrics.expectedTotal_last4Games - game.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                            Diff: {(game.context.teamPerformance.combinedMetrics.expectedTotal_last4Games - game.espnData.totalScore).toFixed(1)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-sm">
                            {game.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg.toFixed(1)}
                          </div>
                          <div className={`text-xs ${Math.abs(game.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg - game.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                            Diff: {(game.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg - game.espnData.totalScore).toFixed(1)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-sm">
                            {game.context.teamPerformance.combinedMetrics.expectedTotal_weighted.toFixed(1)}
                          </div>
                          <div className={`text-xs ${Math.abs(game.context.teamPerformance.combinedMetrics.expectedTotal_weighted - game.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                            Diff: {(game.context.teamPerformance.combinedMetrics.expectedTotal_weighted - game.espnData.totalScore).toFixed(1)}
                          </div>
                        </td>
                        <td className="p-3">
                          {game.context.weather ? (
                            <div className="text-sm">
                              <div>{game.context.weather.temperature}°F</div>
                              <div className="text-xs text-gray-500">{game.context.weather.condition}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              {game.context.venue.isIndoor ? 'Indoor' : 'N/A'}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGame(game);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Game Detail Modal */}
            {selectedGame && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1a1a] border border-[#383838] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-[#383838] flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                      {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                    </h2>
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="text-gray-400 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Game Result */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-2">Final Score</div>
                        <div className="text-2xl font-bold">
                          {selectedGame.espnData.awayScore} - {selectedGame.espnData.homeScore}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Total: {selectedGame.espnData.totalScore}</div>
                      </div>
                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-2">Over/Under Line</div>
                        <div className="text-2xl font-bold">{selectedGame.historicalOdds.overUnder}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {selectedGame.historicalOdds.bookmaker} ({selectedGame.historicalOdds.overUnderOdds})
                        </div>
                      </div>
                    </div>

                    {/* Result */}
                    <div className={`rounded-lg p-4 ${
                      selectedGame.result.wentOver 
                        ? 'bg-green-900/20 border border-green-500/50' 
                        : selectedGame.result.wentUnder 
                        ? 'bg-red-900/20 border border-red-500/50'
                        : 'bg-yellow-900/20 border border-yellow-500/50'
                    }`}>
                      <div className="font-semibold text-lg mb-2">
                        {getResultIcon(selectedGame.result)} {selectedGame.result.wentOver ? 'Went Over' : selectedGame.result.wentUnder ? 'Went Under' : 'Push'}
                      </div>
                      <div className="text-sm text-gray-300">
                        Margin: {selectedGame.result.margin > 0 ? '+' : ''}{selectedGame.result.margin.toFixed(1)} points
                      </div>
                    </div>

                    {/* Contextual Data */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm font-semibold mb-3">Venue & Weather</div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">Venue:</span>{' '}
                            <span className="text-white">{selectedGame.context.venue.name}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Location:</span>{' '}
                            <span className="text-white">{selectedGame.context.venue.city}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Type:</span>{' '}
                            <span className="text-white">{selectedGame.context.venue.isIndoor ? 'Indoor' : 'Outdoor'}</span>
                          </div>
                          {selectedGame.context.weather && (
                            <>
                              <div>
                                <span className="text-gray-400">Temperature:</span>{' '}
                                <span className="text-white">{selectedGame.context.weather.temperature}°F</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Condition:</span>{' '}
                                <span className="text-white">{selectedGame.context.weather.condition}</span>
                              </div>
                              {selectedGame.context.weather.windSpeed && (
                                <div>
                                  <span className="text-gray-400">Wind:</span>{' '}
                                  <span className="text-white">{selectedGame.context.weather.windSpeed} mph</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm font-semibold mb-3">Game Timing</div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">Time Slot:</span>{' '}
                            <span className="text-white capitalize">{selectedGame.context.timeSlot.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">International:</span>{' '}
                            <span className="text-white">{selectedGame.context.isInternational ? 'Yes' : 'No'}</span>
                          </div>
                          {selectedGame.context.restDays && (
                            <>
                              <div>
                                <span className="text-gray-400">Away Rest:</span>{' '}
                                <span className="text-white">{selectedGame.context.restDays.awayTeam} days</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Home Rest:</span>{' '}
                                <span className="text-white">{selectedGame.context.restDays.homeTeam} days</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Team Records */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm font-semibold mb-3">{selectedGame.awayTeam} Record</div>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-gray-400">Record:</span>{' '}
                            <span className="text-white">
                              {selectedGame.context.awayTeamRecord.wins}-{selectedGame.context.awayTeamRecord.losses}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Win %:</span>{' '}
                            <span className="text-white">{(selectedGame.context.awayTeamRecord.winPercentage * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Status:</span>{' '}
                            <span className="text-white capitalize">{selectedGame.context.awayTeamRecord.playoffStatus.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#2a2a2a] rounded-lg p-4">
                        <div className="text-sm font-semibold mb-3">{selectedGame.homeTeam} Record</div>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-gray-400">Record:</span>{' '}
                            <span className="text-white">
                              {selectedGame.context.homeTeamRecord.wins}-{selectedGame.context.homeTeamRecord.losses}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Win %:</span>{' '}
                            <span className="text-white">{(selectedGame.context.homeTeamRecord.winPercentage * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Status:</span>{' '}
                            <span className="text-white capitalize">{selectedGame.context.homeTeamRecord.playoffStatus.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Team Performance Metrics */}
                    <div className="bg-[#2a2a2a] rounded-lg p-4">
                      <div className="text-sm font-semibold mb-4">Team Performance Metrics</div>
                      
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        {/* Away Team */}
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-2">{selectedGame.awayTeam}</div>
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-gray-500">Window</div>
                              <div className="text-gray-500">Scored</div>
                              <div className="text-gray-500">Allowed</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 1</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last1Game.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last1Game.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 2</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last2Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last2Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 3</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last3Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last3Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 4</div>
                              <div className="font-mono font-semibold">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last4Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono font-semibold">{selectedGame.context.teamPerformance.awayTeam.rollingAverages.last4Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Season</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.seasonAverages.pointsScoredPerGame.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.awayTeam.seasonAverages.pointsAllowedPerGame.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Weighted</div>
                              <div className="font-mono text-blue-400">{selectedGame.context.teamPerformance.awayTeam.weightedAverages.pointsScored.toFixed(1)}</div>
                              <div className="font-mono text-blue-400">{selectedGame.context.teamPerformance.awayTeam.weightedAverages.pointsAllowed.toFixed(1)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Home Team */}
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-2">{selectedGame.homeTeam}</div>
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-gray-500">Window</div>
                              <div className="text-gray-500">Scored</div>
                              <div className="text-gray-500">Allowed</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 1</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last1Game.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last1Game.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 2</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last2Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last2Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 3</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last3Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last3Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Last 4</div>
                              <div className="font-mono font-semibold">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last4Games.pointsScored.toFixed(1)}</div>
                              <div className="font-mono font-semibold">{selectedGame.context.teamPerformance.homeTeam.rollingAverages.last4Games.pointsAllowed.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Season</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.seasonAverages.pointsScoredPerGame.toFixed(1)}</div>
                              <div className="font-mono">{selectedGame.context.teamPerformance.homeTeam.seasonAverages.pointsAllowedPerGame.toFixed(1)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>Weighted</div>
                              <div className="font-mono text-blue-400">{selectedGame.context.teamPerformance.homeTeam.weightedAverages.pointsScored.toFixed(1)}</div>
                              <div className="font-mono text-blue-400">{selectedGame.context.teamPerformance.homeTeam.weightedAverages.pointsAllowed.toFixed(1)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Combined Expected Totals */}
                      <div className="border-t border-[#383838] pt-4">
                        <div className="text-xs font-semibold text-gray-400 mb-3">Expected Total (Different Methods)</div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Last 4 Games Avg</div>
                            <div className="text-lg font-mono font-semibold">
                              {selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_last4Games.toFixed(1)}
                            </div>
                            <div className={`text-xs mt-1 ${Math.abs(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_last4Games - selectedGame.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                              Actual: {selectedGame.espnData.totalScore} (Diff: {(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_last4Games - selectedGame.espnData.totalScore).toFixed(1)})
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Season Average</div>
                            <div className="text-lg font-mono font-semibold">
                              {selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg.toFixed(1)}
                            </div>
                            <div className={`text-xs mt-1 ${Math.abs(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg - selectedGame.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                              Actual: {selectedGame.espnData.totalScore} (Diff: {(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_seasonAvg - selectedGame.espnData.totalScore).toFixed(1)})
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Weighted Avg</div>
                            <div className="text-lg font-mono font-semibold text-blue-400">
                              {selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_weighted.toFixed(1)}
                            </div>
                            <div className={`text-xs mt-1 ${Math.abs(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_weighted - selectedGame.espnData.totalScore) < 3 ? 'text-green-400' : 'text-gray-500'}`}>
                              Actual: {selectedGame.espnData.totalScore} (Diff: {(selectedGame.context.teamPerformance.combinedMetrics.expectedTotal_weighted - selectedGame.espnData.totalScore).toFixed(1)})
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Unmatched Games */}
            {(data.unmatchedEspnGames.length > 0 || data.unmatchedOddsGames.length > 0) && (
              <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="font-semibold text-yellow-400 mb-2">
                  ⚠️ Unmatched Games
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  {data.unmatchedEspnGames.length > 0 && (
                    <div>
                      {data.unmatchedEspnGames.length} ESPN game(s) without matching odds
                    </div>
                  )}
                  {data.unmatchedOddsGames.length > 0 && (
                    <div>
                      {data.unmatchedOddsGames.length} Odds API game(s) without matching ESPN data
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

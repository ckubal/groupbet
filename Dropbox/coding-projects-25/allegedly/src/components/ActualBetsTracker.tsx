import { useState } from 'react';
import { Game } from '@/lib/database';
import { PlayerProp } from './PlayerPropsDropdown';
import { Upload, DollarSign, Users, Check, X, Camera, Trash2, Plus } from 'lucide-react';

export interface ActualBet {
  id: string;
  type: 'standard' | 'player_prop' | 'head_to_head';
  gameId: string;
  game: Game;
  betDetails: {
    betType: 'spread' | 'total' | 'moneyline' | 'player_prop';
    selection: string;
    odds: number;
    stake: number;
  };
  creator: string; // userId who placed the bet
  participants: string[]; // userIds who are in on the bet
  status: 'pending' | 'won' | 'lost' | 'push' | 'live';
  createdAt: Date;
  settledAt?: Date;
  imageUrl?: string; // bet slip image
  isVerified: boolean;
  notes?: string;
  // Head to Head specific fields
  h2h?: {
    sideA: {
      selection: string; // e.g., "Chiefs -3.5"
      participants: string[]; // userIds on this side
    };
    sideB: {
      selection: string; // e.g., "Ravens +3.5" 
      participants: string[]; // userIds on this side
    };
    amount: number; // Amount per person
    acceptedBy?: string[]; // userIds who have accepted the bet
    isOpen: boolean; // Whether bet is still accepting participants
  };
}

interface ActualBetsTrackerProps {
  games: Game[];
  users: { id: string; name: string }[];
  currentUserId: string;
  actualBets: ActualBet[];
  onAddBet: (bet: Omit<ActualBet, 'id' | 'createdAt'>) => void;
  onUpdateBet: (betId: string, updates: Partial<ActualBet>) => void;
  onDeleteBet: (betId: string) => void;
}

export default function ActualBetsTracker({
  games,
  users,
  currentUserId,
  actualBets,
  onAddBet,
  onUpdateBet,
  onDeleteBet
}: ActualBetsTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBet, setNewBet] = useState<Partial<ActualBet>>({
    type: 'standard',
    betDetails: { betType: 'spread', selection: '', odds: -110, stake: 25 },
    participants: [currentUserId],
    creator: currentUserId,
    status: 'pending',
    isVerified: false
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const getUserName = (userId: string): string => {
    return users.find(u => u.id === userId)?.name || userId;
  };

  const handleAddBet = async () => {
    if (!newBet.gameId || !newBet.betDetails?.selection) {
      alert('Please fill out all required fields');
      return;
    }

    const selectedGame = games.find(g => g.id === newBet.gameId);
    if (!selectedGame) return;

    // Check for duplicates based on game + bet type + selection + similar odds
    const duplicate = actualBets.find(bet => 
      bet.gameId === newBet.gameId &&
      bet.betDetails.betType === newBet.betDetails!.betType &&
      bet.betDetails.selection === newBet.betDetails!.selection &&
      Math.abs(bet.betDetails.odds - (newBet.betDetails!.odds || -110)) <= 10 && // Within 10 odds points
      bet.creator === currentUserId
    );

    if (duplicate) {
      const shouldContinue = confirm(`You already have a similar bet: ${duplicate.betDetails.selection} at ${duplicate.betDetails.odds}. Add anyway?`);
      if (!shouldContinue) return;
    }

    let imageUrl = undefined;
    if (imageFile) {
      // In a real app, upload to cloud storage (Firebase Storage, AWS S3, etc.)
      // For now, create a local object URL for demo
      imageUrl = URL.createObjectURL(imageFile);
    }

    const betToAdd: Omit<ActualBet, 'id' | 'createdAt'> = {
      type: newBet.type!,
      gameId: newBet.gameId!,
      game: selectedGame,
      betDetails: newBet.betDetails!,
      creator: currentUserId,
      participants: newBet.participants || [currentUserId],
      status: 'pending',
      isVerified: false,
      imageUrl,
      notes: newBet.notes
    };

    onAddBet(betToAdd);
    
    // Reset form
    setNewBet({
      type: 'standard',
      betDetails: { betType: 'spread', selection: '', odds: -110, stake: 25 },
      participants: [currentUserId],
      creator: currentUserId,
      status: 'pending',
      isVerified: false
    });
    setImageFile(null);
    setShowAddForm(false);
  };

  const handleParticipantToggle = (betId: string, userId: string) => {
    const bet = actualBets.find(b => b.id === betId);
    if (!bet) return;

    const isParticipant = bet.participants.includes(userId);
    const newParticipants = isParticipant
      ? bet.participants.filter(p => p !== userId)
      : [...bet.participants, userId];

    onUpdateBet(betId, { participants: newParticipants });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    }
  };

  const formatOdds = (odds: number): string => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getStatusColor = (status: ActualBet['status']): string => {
    switch (status) {
      case 'won': return 'bg-green-100 text-green-800 border-green-300';
      case 'lost': return 'bg-red-100 text-red-800 border-red-300';
      case 'push': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'live': return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const calculatePotentialWin = (stake: number, odds: number): number => {
    if (odds > 0) {
      return (stake * odds) / 100;
    } else {
      return (stake * 100) / Math.abs(odds);
    }
  };

  const activeBets = actualBets.filter(bet => bet.status === 'pending' || bet.status === 'live');
  const settledBets = actualBets.filter(bet => bet.status === 'won' || bet.status === 'lost' || bet.status === 'push');

  return (
    <div className="space-y-6">
      {/* Add New Bet */}
      <div className="bg-white rounded-lg shadow-md p-4 border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="text-green-600" size={20} />
            Actual Bets Placed
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus size={16} />
            Add Bet
          </button>
        </div>

        {showAddForm && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Game</label>
                <select
                  value={newBet.gameId || ''}
                  onChange={(e) => setNewBet({ ...newBet, gameId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select game...</option>
                  {games.map(game => (
                    <option key={game.id} value={game.id}>
                      {game.awayTeam} @ {game.homeTeam}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bet Type</label>
                <select
                  value={newBet.betDetails?.betType || ''}
                  onChange={(e) => setNewBet({
                    ...newBet,
                    betDetails: { ...newBet.betDetails!, betType: e.target.value as any }
                  })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="spread">Spread</option>
                  <option value="total">Total</option>
                  <option value="moneyline">Moneyline</option>
                  <option value="player_prop">Player Prop</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Selection</label>
                <input
                  type="text"
                  value={newBet.betDetails?.selection || ''}
                  onChange={(e) => setNewBet({
                    ...newBet,
                    betDetails: { ...newBet.betDetails!, selection: e.target.value }
                  })}
                  placeholder="e.g., Chiefs -3.5"
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Odds</label>
                <input
                  type="number"
                  value={newBet.betDetails?.odds || -110}
                  onChange={(e) => setNewBet({
                    ...newBet,
                    betDetails: { ...newBet.betDetails!, odds: Number(e.target.value) }
                  })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stake ($)</label>
                <input
                  type="number"
                  value={newBet.betDetails?.stake || 25}
                  onChange={(e) => setNewBet({
                    ...newBet,
                    betDetails: { ...newBet.betDetails!, stake: Number(e.target.value) }
                  })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Participants</label>
              <div className="flex flex-wrap gap-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      const participants = newBet.participants || [];
                      const isIncluded = participants.includes(user.id);
                      setNewBet({
                        ...newBet,
                        participants: isIncluded
                          ? participants.filter(p => p !== user.id)
                          : [...participants, user.id]
                      });
                    }}
                    className={`px-2 py-1 text-xs rounded border ${
                      (newBet.participants || []).includes(user.id)
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bet Slip Image (Optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="bet-image"
                />
                <label
                  htmlFor="bet-image"
                  className="flex items-center gap-2 px-3 py-2 border rounded text-sm cursor-pointer hover:bg-gray-50"
                >
                  <Camera size={16} />
                  {imageFile ? imageFile.name : 'Upload Image'}
                </label>
                {imageFile && (
                  <button
                    onClick={() => setImageFile(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={newBet.notes || ''}
                onChange={(e) => setNewBet({ ...newBet, notes: e.target.value })}
                placeholder="Any additional notes about this bet"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBet}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add Bet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-semibold mb-3 text-gray-800">Active Bets ({activeBets.length})</h4>
          <div className="space-y-3">
            {activeBets.map(bet => (
              <div key={bet.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-600">
                      {bet.game.awayTeam} @ {bet.game.homeTeam}
                    </div>
                    {bet.type === 'head_to_head' && bet.h2h ? (
                      <div>
                        <div className="font-semibold text-purple-700 flex items-center gap-1">
                          ⚔️ Head to Head Bet
                        </div>
                        <div className="text-sm space-y-1 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="font-medium">{bet.h2h.sideA.selection}</span>
                            <span className="text-gray-500 text-xs">
                              ({bet.h2h.sideA.participants.map(p => getUserName(p)).join(', ')})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="font-medium">{bet.h2h.sideB.selection}</span>
                            <span className="text-gray-500 text-xs">
                              ({bet.h2h.sideB.participants.map(p => getUserName(p)).join(', ')})
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          ${bet.h2h.amount} per person • Total pool: ${bet.h2h.amount * (bet.h2h.sideA.participants.length + bet.h2h.sideB.participants.length)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-gray-800">
                          {bet.betDetails.selection} ({formatOdds(bet.betDetails.odds)})
                        </div>
                        <div className="text-sm text-gray-600">
                          ${bet.betDetails.stake} to win ${calculatePotentialWin(bet.betDetails.stake, bet.betDetails.odds).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs border ${getStatusColor(bet.status)}`}>
                      {bet.status.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      by {getUserName(bet.creator)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gray-500" />
                    <span className="text-gray-600">
                      {bet.participants.map(p => getUserName(p)).join(', ')}
                    </span>
                  </div>
                  
                  <div className="flex gap-1">
                    {bet.imageUrl && (
                      <button
                        onClick={() => window.open(bet.imageUrl, '_blank')}
                        className="text-blue-600 hover:text-blue-700"
                        title="View bet slip"
                      >
                        <Camera size={16} />
                      </button>
                    )}
                    {bet.creator === currentUserId && (
                      <button
                        onClick={() => onDeleteBet(bet.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete bet"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {bet.notes && (
                  <div className="text-xs text-gray-600 mt-2 italic">
                    Note: {bet.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settled Bets */}
      {settledBets.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-semibold mb-3 text-gray-800">Settled Bets ({settledBets.length})</h4>
          <div className="space-y-2">
            {settledBets.map(bet => (
              <div key={bet.id} className="border rounded p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">
                      {bet.betDetails.selection} ({formatOdds(bet.betDetails.odds)})
                    </div>
                    <div className="text-xs text-gray-600">
                      {bet.game.awayTeam} @ {bet.game.homeTeam}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs border ${getStatusColor(bet.status)}`}>
                      {bet.status.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {bet.status === 'won' ? '+' : bet.status === 'lost' ? '-' : ''}${
                        bet.status === 'won' 
                          ? calculatePotentialWin(bet.betDetails.stake, bet.betDetails.odds).toFixed(2)
                          : bet.status === 'lost'
                          ? bet.betDetails.stake.toFixed(2)
                          : '0.00'
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No bets message */}
      {actualBets.length === 0 && (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <DollarSign className="mx-auto mb-3 text-gray-400" size={48} />
          <p className="text-gray-600">No actual bets recorded yet</p>
          <p className="text-sm text-gray-500 mt-1">Add your first bet to start tracking!</p>
        </div>
      )}
    </div>
  );
}
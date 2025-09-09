import { useState } from 'react';
import { Plus, DollarSign, Trash2, User } from 'lucide-react';

interface HeadToHeadBet {
  id: string;
  gameId: string;
  bettor1: string;
  bettor2: string;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: Date;
}

interface HeadToHeadBetsProps {
  gameId: string;
  bets: HeadToHeadBet[];
  onAddBet: (bet: Omit<HeadToHeadBet, 'id' | 'createdAt'>) => void;
  onRemoveBet: (betId: string) => void;
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
}

export default function HeadToHeadBets({ 
  gameId, 
  bets, 
  onAddBet, 
  onRemoveBet, 
  users, 
  currentUserId 
}: HeadToHeadBetsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [bettor1, setBettor1] = useState('');
  const [bettor2, setBettor2] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bettor1 || !bettor2 || !amount || !description) return;
    
    onAddBet({
      gameId,
      bettor1,
      bettor2,
      amount: parseFloat(amount),
      description,
      createdBy: currentUserId,
    });

    // Reset form
    setBettor1('');
    setBettor2('');
    setAmount('');
    setDescription('');
    setIsAdding(false);
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || userId;
  };

  const gameBets = bets.filter(bet => bet.gameId === gameId);

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Head-to-Head Bets</span>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <Plus size={14} />
            Add Bet
          </button>
        )}
      </div>

      {/* Existing Bets */}
      {gameBets.length > 0 && (
        <div className="space-y-2 mb-3">
          {gameBets.map(bet => (
            <div key={bet.id} className="bg-white rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {getUserName(bet.bettor1)} vs {getUserName(bet.bettor2)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    ${bet.amount} • {bet.description}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Added by {getUserName(bet.createdBy)}
                  </div>
                </div>
                
                {bet.createdBy === currentUserId && (
                  <button
                    onClick={() => onRemoveBet(bet.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Bet Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white rounded border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Bettor 1</label>
              <select
                value={bettor1}
                onChange={(e) => setBettor1(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                required
              >
                <option value="">Choose...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs text-gray-600 block mb-1">Bettor 2</label>
              <select
                value={bettor2}
                onChange={(e) => setBettor2(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                required
              >
                <option value="">Choose...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              className="w-full text-sm border border-gray-200 rounded px-2 py-1"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Bet Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chiefs moneyline"
              className="w-full text-sm border border-gray-200 rounded px-2 py-1"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Add Bet
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setBettor1('');
                setBettor2('');
                setAmount('');
                setDescription('');
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {gameBets.length === 0 && !isAdding && (
        <div className="text-xs text-gray-500 text-center py-2">
          No head-to-head bets yet
        </div>
      )}
    </div>
  );
}
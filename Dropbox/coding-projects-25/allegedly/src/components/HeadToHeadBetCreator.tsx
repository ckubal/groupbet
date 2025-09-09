import { useState, useEffect } from 'react';
import { Game } from '@/lib/database';
import { ActualBet } from './ActualBetsTracker';
import { Users, Sword, DollarSign, X, Plus } from 'lucide-react';

interface HeadToHeadBetCreatorProps {
  game: Game;
  users: { id: string; name: string }[];
  currentUserId: string;
  onCreateBet: (bet: Omit<ActualBet, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

// Core 4 friends + initiator
const CORE_FRIENDS = ['will', 'do', 'rosen', 'charlie'];

export default function HeadToHeadBetCreator({ 
  game, 
  users, 
  currentUserId, 
  onCreateBet, 
  onClose 
}: HeadToHeadBetCreatorProps) {
  const [betType, setBetType] = useState<'spread' | 'total' | 'moneyline'>('spread');
  const [amount, setAmount] = useState(25);
  const [sideASelection, setSideASelection] = useState('');
  const [sideBSelection, setSideBSelection] = useState('');
  const [sideAParticipants, setSideAParticipants] = useState<string[]>([currentUserId]);
  const [sideBParticipants, setSideBParticipants] = useState<string[]>([]);
  const [availableParticipants, setAvailableParticipants] = useState<string[]>(
    CORE_FRIENDS.filter(id => id !== currentUserId)
  );

  const getUserName = (userId: string): string => {
    return users.find(u => u.id === userId)?.name || userId;
  };

  const generateBetSelections = () => {
    switch (betType) {
      case 'spread':
        // Parse the spread line to create both sides
        const spreadLine = parseFloat(game.odds.spread.line);
        if (!isNaN(spreadLine)) {
          setSideASelection(`${game.awayTeam} ${spreadLine > 0 ? '+' : ''}${spreadLine}`);
          setSideBSelection(`${game.homeTeam} ${spreadLine > 0 ? '' : '+'}${-spreadLine}`);
        }
        break;
      case 'total':
        const totalLine = parseFloat(game.odds.total.line);
        if (!isNaN(totalLine)) {
          setSideASelection(`Over ${totalLine}`);
          setSideBSelection(`Under ${totalLine}`);
        }
        break;
      case 'moneyline':
        setSideASelection(`${game.awayTeam} Win`);
        setSideBSelection(`${game.homeTeam} Win`);
        break;
    }
  };

  const handleBetTypeChange = (newType: 'spread' | 'total' | 'moneyline') => {
    setBetType(newType);
    // Auto-generate selections based on game odds
    setTimeout(generateBetSelections, 0);
  };

  const toggleParticipant = (userId: string, side: 'A' | 'B') => {
    if (side === 'A') {
      setSideAParticipants(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
      // Remove from side B if they were there
      setSideBParticipants(prev => prev.filter(id => id !== userId));
    } else {
      setSideBParticipants(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
      // Remove from side A if they were there
      setSideAParticipants(prev => prev.filter(id => id !== userId));
    }
  };

  const handleCreateBet = () => {
    if (!sideASelection || !sideBSelection || sideAParticipants.length === 0 || sideBParticipants.length === 0) {
      alert('Please complete all bet details and ensure both sides have participants');
      return;
    }

    const h2hBet: Omit<ActualBet, 'id' | 'createdAt'> = {
      type: 'head_to_head',
      gameId: game.id,
      game: game,
      betDetails: {
        betType: betType,
        selection: `H2H: ${sideASelection} vs ${sideBSelection}`,
        odds: 100, // Even odds for H2H (no vig)
        stake: amount * (sideAParticipants.length + sideBParticipants.length)
      },
      creator: currentUserId,
      participants: [...sideAParticipants, ...sideBParticipants],
      status: 'pending',
      isVerified: false,
      h2h: {
        sideA: {
          selection: sideASelection,
          participants: sideAParticipants
        },
        sideB: {
          selection: sideBSelection, 
          participants: sideBParticipants
        },
        amount: amount,
        acceptedBy: [currentUserId], // Creator auto-accepts
        isOpen: true
      }
    };

    onCreateBet(h2hBet);
    onClose();
  };

  // Initialize selections on mount
  useEffect(() => {
    generateBetSelections();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sword className="text-blue-600" size={20} />
                Create Head to Head Bet
              </h3>
              <p className="text-sm text-gray-600">
                {game.awayTeam} @ {game.homeTeam}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Bet Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Bet Type</label>
            <div className="flex gap-2">
              {(['spread', 'total', 'moneyline'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleBetTypeChange(type)}
                  className={`px-3 py-2 rounded text-sm ${
                    betType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Per Person */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Amount Per Person</label>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-gray-500" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="border rounded px-3 py-2 w-32"
                min="1"
              />
            </div>
          </div>

          {/* Bet Sides */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Side A */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h4 className="font-semibold">Side A</h4>
              </div>
              
              <div className="mb-3">
                <input
                  type="text"
                  value={sideASelection}
                  onChange={(e) => setSideASelection(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Enter selection..."
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Participants ({sideAParticipants.length})</div>
                <div className="space-y-1">
                  {/* Show current participants */}
                  {sideAParticipants.map(userId => (
                    <div key={userId} className="flex items-center justify-between text-sm bg-blue-50 rounded px-2 py-1">
                      <span>{getUserName(userId)}</span>
                      {userId !== currentUserId && (
                        <button
                          onClick={() => toggleParticipant(userId, 'A')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {/* Available users to add */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {availableParticipants
                      .filter(userId => !sideAParticipants.includes(userId) && !sideBParticipants.includes(userId))
                      .map(userId => (
                      <button
                        key={userId}
                        onClick={() => toggleParticipant(userId, 'A')}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-blue-100 rounded border"
                      >
                        + {getUserName(userId)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Side B */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <h4 className="font-semibold">Side B</h4>
              </div>
              
              <div className="mb-3">
                <input
                  type="text"
                  value={sideBSelection}
                  onChange={(e) => setSideBSelection(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Enter selection..."
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Participants ({sideBParticipants.length})</div>
                <div className="space-y-1">
                  {/* Show current participants */}
                  {sideBParticipants.map(userId => (
                    <div key={userId} className="flex items-center justify-between text-sm bg-red-50 rounded px-2 py-1">
                      <span>{getUserName(userId)}</span>
                      <button
                        onClick={() => toggleParticipant(userId, 'B')}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {/* Available users to add */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {availableParticipants
                      .filter(userId => !sideAParticipants.includes(userId) && !sideBParticipants.includes(userId))
                      .map(userId => (
                      <button
                        key={userId}
                        onClick={() => toggleParticipant(userId, 'B')}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-red-100 rounded border"
                      >
                        + {getUserName(userId)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-2">Bet Summary</h4>
            <div className="text-sm space-y-1">
              <div>Game: {game.awayTeam} @ {game.homeTeam}</div>
              <div>Type: {betType}</div>
              <div>Amount: ${amount} per person</div>
              <div>Total Pool: ${amount * (sideAParticipants.length + sideBParticipants.length)}</div>
              <div>Winners Split: ${amount * (sideAParticipants.length + sideBParticipants.length)} (no vig)</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBet}
              disabled={sideAParticipants.length === 0 || sideBParticipants.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
            >
              Create H2H Bet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
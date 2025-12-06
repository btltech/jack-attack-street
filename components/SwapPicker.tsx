// components/SwapPicker.tsx - Modal for King card player selection
import React from 'react';
import { Player } from '../core/types';

interface SwapPickerProps {
    players: Player[];
    currentPlayerId: string;
    onSelectPlayer: (playerId: string) => void;
}

const SwapPicker: React.FC<SwapPickerProps> = ({ players, currentPlayerId, onSelectPlayer }) => {
    const otherPlayers = players.filter(p => p.id !== currentPlayerId);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-yellow-400 max-w-sm w-full mx-4">
                <h2 className="text-3xl font-black text-center text-purple-600 mb-2">🤴 SWAP HANDS!</h2>
                <p className="text-center text-gray-600 font-bold mb-6">Choose who to swap with:</p>

                <div className="space-y-3">
                    {otherPlayers.map(player => (
                        <button
                            key={player.id}
                            onClick={() => onSelectPlayer(player.id)}
                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white py-4 px-6 rounded-2xl border-b-4 border-purple-800 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-between shadow-lg"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-4xl">{player.avatar}</span>
                                <span className="font-black text-xl">{player.name}</span>
                            </div>
                            <div className="bg-white/20 px-4 py-2 rounded-xl">
                                <span className="font-bold">{player.hand.length} cards</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SwapPicker;

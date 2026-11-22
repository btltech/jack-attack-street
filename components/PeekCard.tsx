// components/PeekCard.tsx - Overlay showing peeked card from 7
import React, { useEffect } from 'react';
import { Card, Player } from '../core/types';

interface PeekCardProps {
    card: Card;
    player: Player | undefined;
    onDismiss: () => void;
}

const PeekCard: React.FC<PeekCardProps> = ({ card, player, onDismiss }) => {
    const isRed = ['♥', '♦'].includes(card.suit);
    const suitColor = isRed ? 'text-red-600' : 'text-gray-900';
    const ownerLabel = !player
        ? "Opponent's Card"
        : player.name === 'You'
            ? 'Your Card'
            : `${player.name}'s Card`;

    // Auto-dismiss after 3 seconds
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] animate-in fade-in cursor-pointer"
            onClick={onDismiss}
        >
            <div className="text-center">
                <div className="mb-4 text-white">
                    <span className="text-5xl">{player?.avatar}</span>
                    <p className="text-2xl font-black mt-2">{ownerLabel}</p>
                    <p className="text-lg text-gray-300">👁️ You peeked at one of their cards!</p>
                </div>

                {/* The revealed card */}
                <div className="relative w-32 h-48 md:w-40 md:h-56 bg-white rounded-2xl border-b-8 border-gray-300 shadow-2xl mx-auto flex flex-col justify-between p-4 animate-in zoom-in-95">
                    <div className="flex flex-col items-start leading-none">
                        <span className={`font-black text-3xl ${suitColor}`}>{card.rank}</span>
                        <span className={`text-4xl ${suitColor}`}>{card.suit}</span>
                    </div>
                    <div className={`absolute inset-0 flex items-center justify-center text-9xl opacity-10 pointer-events-none ${suitColor}`}>
                        {card.suit}
                    </div>
                    <div className="flex flex-col items-end leading-none transform rotate-180">
                        <span className={`font-black text-3xl ${suitColor}`}>{card.rank}</span>
                        <span className={`text-4xl ${suitColor}`}>{card.suit}</span>
                    </div>
                </div>

                <p className="text-white mt-4 text-sm animate-pulse">Tap anywhere to dismiss</p>
            </div>
        </div>
    );
};

export default PeekCard;

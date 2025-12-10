// components/PowerUpShop.tsx - Shop Modal for purchasing power-ups

import React, { useState, useEffect } from 'react';
import { powerUpCatalog, PowerUp, PowerUpInventory, loadInventory, purchasePowerUp, getRarityColor, getRarityBg } from '../core/powerups';
import { playClickSound, playCoinsSound } from '../core/sounds';

interface PowerUpShopProps {
    coins: number;
    onPurchase: (newCoins: number) => void;
    onClose: () => void;
}

const PowerUpShop: React.FC<PowerUpShopProps> = ({ coins, onPurchase, onClose }) => {
    const [inventory, setInventory] = useState<PowerUpInventory>(loadInventory());
    const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handlePurchase = (powerUp: PowerUp) => {
        playClickSound();
        const result = purchasePowerUp(powerUp.id, coins);

        if (result) {
            playCoinsSound();
            onPurchase(result.newCoins);
            setInventory(result.inventory);
            setPurchaseMessage(`✅ Bought ${powerUp.name}!`);
            setTimeout(() => setPurchaseMessage(null), 2000);
        } else {
            setPurchaseMessage(`❌ Not enough coins!`);
            setTimeout(() => setPurchaseMessage(null), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-6 rounded-[2rem] max-w-lg w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform"
                >
                    ❌
                </button>

                <h3 className="text-3xl font-black mb-2 text-center text-yellow-400">🛒 Power-Up Shop</h3>

                {/* Coin Balance with Tooltip */}
                <div className="flex justify-center mb-4">
                    <div
                        className="bg-yellow-400 text-black px-6 py-2 rounded-full font-bold border-b-4 border-yellow-600 flex items-center gap-2 text-lg cursor-help"
                        title="Earn coins by winning games! +10 for wins, +25 for Hard wins, +5 bonus for win streaks."
                    >
                        <span className="text-2xl">🪙</span>
                        <span>{coins}</span>
                    </div>
                </div>

                {/* 0 Coins Message */}
                {coins === 0 && (
                    <div className="text-center mb-4 bg-blue-500/20 border border-blue-400/50 rounded-xl p-3">
                        <p className="text-blue-200 text-sm font-bold">💡 Win games to earn coins and buy power-ups!</p>
                    </div>
                )}

                {/* Purchase Confirmation Toast */}
                {purchaseMessage && (
                    <div className={`text-center mb-4 font-bold text-lg p-3 rounded-xl ${purchaseMessage.includes('✅') ? 'bg-green-500/30 border border-green-400' : 'bg-red-500/30 border border-red-400'}`}>
                        {purchaseMessage}
                    </div>
                )}

                {/* Power-Up Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {powerUpCatalog.map((powerUp) => {
                        const owned = inventory[powerUp.id] || 0;
                        const canAfford = coins >= powerUp.cost;

                        return (
                            <button
                                key={powerUp.id}
                                onClick={() => handlePurchase(powerUp)}
                                disabled={!canAfford}
                                className={`p-4 rounded-xl bg-gradient-to-br ${getRarityBg(powerUp.rarity)} border-2 transition-all ${canAfford
                                    ? 'border-white/30 hover:border-white/60 hover:scale-105 cursor-pointer'
                                    : 'border-gray-600 opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                <div className="text-3xl mb-1">{powerUp.emoji}</div>
                                <div className="font-bold text-sm">{powerUp.name}</div>
                                <div className={`text-xs uppercase font-bold ${getRarityColor(powerUp.rarity)}`}>
                                    {powerUp.rarity}
                                </div>
                                <div className="text-xs text-white/70 mt-1 line-clamp-2">
                                    {powerUp.description}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                                        🪙 {powerUp.cost}
                                    </span>
                                    {owned > 0 && (
                                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                            x{owned}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Inventory Summary */}
                <div className="bg-white/10 rounded-xl p-3 mb-4">
                    <h4 className="font-bold text-sm mb-2">Your Inventory</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(inventory).length === 0 ? (
                            <span className="text-white/50 text-sm">No power-ups yet</span>
                        ) : (
                            Object.entries(inventory).map(([id, count]) => {
                                const powerUp = powerUpCatalog.find(p => p.id === id);
                                if (!powerUp || (count as number) <= 0) return null;
                                return (
                                    <span key={id} className="bg-white/20 px-2 py-1 rounded-full text-sm flex items-center gap-1">
                                        {powerUp.emoji} {powerUp.name} x{count}
                                    </span>
                                );
                            })
                        )}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl border-b-4 border-yellow-600 hover:bg-yellow-300"
                >
                    Done Shopping
                </button>
            </div>
        </div>
    );
};

export default PowerUpShop;

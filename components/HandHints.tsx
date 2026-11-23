// components/HandHints.tsx - Hints overlay to help players make better choices

import React from 'react';
import { Card, GameState } from '../core/types';
import { isValidMove } from '../core/game';

interface HandHintsProps {
    gameState: GameState;
    enabled: boolean;
}

interface CardSuggestion {
    card: Card;
    reason: string;
    priority: number; // Higher = better play
}

const getCardSuggestions = (gameState: GameState): CardSuggestion[] => {
    const player = gameState.players[0]; // Human player is always index 0
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const activeSuit = gameState.chosenSuit ?? topCard.suit;
    const suggestions: CardSuggestion[] = [];

    const mustDefend = gameState.pendingPickup > 0;

    player.hand.forEach(card => {
        const isValid = isValidMove(card, topCard, gameState.pendingPickup, gameState.chosenSuit);
        if (!isValid) return;

        let priority = 0;
        let reason = '';

        // Defense against attack
        if (mustDefend) {
            if (card.rank === '2') {
                priority = 90;
                reason = '🛡️ Defend with 2 - pass attack!';
            } else if (card.rank === 'J' && (card.suit === '♠' || card.suit === '♣')) {
                priority = 95;
                reason = '🔥 Counter with Black Jack!';
            }
        } else {
            // Strategic priorities

            // Play attack cards to pressure opponent
            if (card.rank === '2') {
                priority = 70;
                reason = '💥 Attack! Next player draws 2';
            } else if (card.rank === 'J' && (card.suit === '♠' || card.suit === '♣')) {
                priority = 85;
                reason = '🔥 Devastating Black Jack attack!';
            }

            // Wild cards are flexible but valuable
            else if (card.rank === 'Q') {
                // Only suggest Queen if we have few matching cards
                const matchingCards = player.hand.filter(c => c.suit === activeSuit && c.rank !== 'Q').length;
                if (matchingCards <= 1) {
                    priority = 60;
                    reason = '👑 Wild - change suit!';
                } else {
                    priority = 20;
                    reason = '👑 Save Queen for later';
                }
            }

            // Swap only if we have more cards
            else if (card.rank === 'K') {
                const otherPlayers = gameState.players.filter(p => p.id !== player.id);
                const minOpponentCards = Math.min(...otherPlayers.map(p => p.hand.length));
                if (player.hand.length > minOpponentCards + 2) {
                    priority = 80;
                    reason = '🤴 Swap - get fewer cards!';
                } else {
                    priority = 15;
                    reason = '🤴 Keep King for emergency';
                }
            }

            // Skip and reverse are useful
            else if (card.rank === '8') {
                priority = 50;
                reason = '🚫 Skip next player';
            } else if (card.rank === 'A') {
                priority = 45;
                reason = '↩️ Reverse direction';
            }

            // Peek for info
            else if (card.rank === '7') {
                priority = 40;
                reason = '👁️ Peek at opponent card';
            }

            // Regular playable card
            else {
                priority = 30;
                reason = '✓ Valid play';
            }
        }

        if (priority > 0) {
            suggestions.push({ card, reason, priority });
        }
    });

    // Sort by priority (highest first)
    return suggestions.sort((a, b) => b.priority - a.priority);
};

const HandHints: React.FC<HandHintsProps> = ({ gameState, enabled }) => {
    if (!enabled) return null;

    const isPlayerTurn = gameState.currentPlayerIndex === 0;
    if (!isPlayerTurn) return null;

    const suggestions = getCardSuggestions(gameState);
    const bestSuggestion = suggestions[0];

    const positionClasses = "fixed top-[4.25rem] right-4 max-md:top-auto max-md:bottom-[16.75rem] max-md:left-1/2 max-md:right-auto max-md:-translate-x-1/2 max-md:w-max z-40 max-w-[260px] text-center shadow-lg pointer-events-none";

    if (!bestSuggestion) {
        if (gameState.pendingPickup > 0) {
            return (
                <div className={`${positionClasses} bg-red-500/95 text-white px-4 py-2 rounded-2xl font-bold text-xs md:text-sm backdrop-blur-sm border-2 border-red-300 animate-pulse`}>
                    💡 No defense! Draw {gameState.pendingPickup} cards
                </div>
            );
        }
        return (
            <div className={`${positionClasses} bg-blue-500/95 text-white px-4 py-2 rounded-2xl font-bold text-xs md:text-sm backdrop-blur-sm border-2 border-blue-300`}>
                💡 No playable cards - draw one!
            </div>
        );
    }

    return (
        <div className={`${positionClasses} bg-gradient-to-r from-green-500/95 to-emerald-600/95 text-white px-4 py-2 rounded-2xl font-bold text-xs md:text-sm backdrop-blur-sm border-2 border-green-300`}>
            💡 Tip: Play {bestSuggestion.card.rank}{bestSuggestion.card.suit} - {bestSuggestion.reason}
        </div>
    );
};

export default HandHints;

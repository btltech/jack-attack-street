// components/DailyChallenge.tsx - Daily Challenge Display Component

import React, { useState, useEffect } from 'react';
import { getTodaysChallenge, getDailyProgress, Challenge, DailyProgress } from '../core/challenges';

interface DailyChallengeProps {
    onClaim?: (reward: { coins: number; unlockId?: string }) => void;
}

const DailyChallenge: React.FC<DailyChallengeProps> = ({ onClaim }) => {
    const [showModal, setShowModal] = useState(false);
    const challenge = getTodaysChallenge();
    const progress = getDailyProgress();

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowModal(false);
            }
        };
        if (showModal) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [showModal]);

    const handleClaim = () => {
        if (progress.completed && onClaim) {
            onClaim(challenge.reward);
            setShowModal(false);
        }
    };

    const difficultyColor = {
        easy: 'text-green-400',
        medium: 'text-yellow-400',
        hard: 'text-red-400',
    };

    const difficultyBg = {
        easy: 'bg-green-500/20',
        medium: 'bg-yellow-500/20',
        hard: 'bg-red-500/20',
    };

    return (
        <>
            {/* Clickable Card Preview */}
            <button
                onClick={() => setShowModal(true)}
                className="w-full bg-gradient-to-r from-purple-600/50 to-pink-600/50 p-4 rounded-2xl border-2 border-purple-400/30 backdrop-blur-sm hover:border-purple-400/60 hover:scale-[1.02] transition-all cursor-pointer text-left"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{challenge.emoji}</span>
                        <div>
                            <h4 className="font-bold text-white text-sm">Daily Challenge</h4>
                            <span className={`text-xs uppercase font-bold ${difficultyColor[challenge.difficulty]}`}>
                                {challenge.difficulty}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-400 font-bold">
                            <span>🪙</span>
                            <span>{challenge.reward.coins}</span>
                        </div>
                        {progress.completed ? (
                            <span className="text-xs text-green-400 font-bold">✅ Complete!</span>
                        ) : (
                            <span className="text-xs text-purple-300">{Math.round(progress.progress)}%</span>
                        )}
                    </div>
                </div>
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-6 rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-yellow-400">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-3xl hover:rotate-90 transition-transform"
                            aria-label="Close modal"
                        >
                            ❌
                        </button>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <span className="text-6xl mb-2 block">{challenge.emoji}</span>
                            <h3 className="text-2xl font-black text-yellow-400">Daily Challenge</h3>
                            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs uppercase font-bold ${difficultyBg[challenge.difficulty]} ${difficultyColor[challenge.difficulty]}`}>
                                {challenge.difficulty}
                            </span>
                        </div>

                        {/* Description */}
                        <div className="bg-white/10 rounded-xl p-4 mb-4">
                            <p className="text-purple-100 text-center font-bold">{challenge.description}</p>
                        </div>

                        {/* Reward */}
                        <div className="bg-yellow-500/20 rounded-xl p-4 mb-4 text-center">
                            <h4 className="text-sm font-bold text-yellow-300 mb-2">REWARD</h4>
                            <div className="flex items-center justify-center gap-2 text-2xl font-black text-yellow-400">
                                <span>🪙</span>
                                <span>+{challenge.reward.coins} Coins</span>
                            </div>
                            {challenge.reward.unlockId && (
                                <div className="mt-2 text-purple-300 text-sm">+ Special Unlock!</div>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-purple-300">Progress</span>
                                <span className="font-bold text-white">{Math.round(progress.progress)}%</span>
                            </div>
                            <div className="relative h-4 bg-black/30 rounded-full overflow-hidden">
                                <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progress.completed ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                                        }`}
                                    style={{ width: `${progress.progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl border-b-4 border-gray-800"
                            >
                                Close
                            </button>
                            {progress.completed && (
                                <button
                                    onClick={handleClaim}
                                    className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl border-b-4 border-green-700 animate-pulse"
                                >
                                    🎁 Claim Reward!
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DailyChallenge;

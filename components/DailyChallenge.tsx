// components/DailyChallenge.tsx - Daily Challenge Display Component

import React from 'react';
import { getTodaysChallenge, getDailyProgress, Challenge, DailyProgress } from '../core/challenges';

interface DailyChallengeProps {
    onClaim?: (reward: { coins: number; unlockId?: string }) => void;
}

const DailyChallenge: React.FC<DailyChallengeProps> = ({ onClaim }) => {
    const challenge = getTodaysChallenge();
    const progress = getDailyProgress();

    const handleClaim = () => {
        if (progress.completed && onClaim) {
            onClaim(challenge.reward);
        }
    };

    const difficultyColor = {
        easy: 'text-green-400',
        medium: 'text-yellow-400',
        hard: 'text-red-400',
    };

    return (
        <div className="bg-gradient-to-r from-purple-600/50 to-pink-600/50 p-4 rounded-2xl border-2 border-purple-400/30 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
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
                    {challenge.reward.unlockId && (
                        <span className="text-xs text-purple-300">+ Unlock!</span>
                    )}
                </div>
            </div>

            <p className="text-purple-100 text-sm mb-3">{challenge.description}</p>

            {/* Progress Bar */}
            <div className="relative h-3 bg-black/30 rounded-full overflow-hidden mb-2">
                <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progress.completed ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                        }`}
                    style={{ width: `${progress.progress}%` }}
                />
            </div>

            <div className="flex justify-between items-center text-xs">
                <span className="text-purple-300">
                    {progress.completed ? '✅ Complete!' : `${Math.round(progress.progress)}% Progress`}
                </span>
                {progress.completed && (
                    <button
                        onClick={handleClaim}
                        className="bg-green-500 hover:bg-green-400 text-white px-3 py-1 rounded-full font-bold text-xs border-b-2 border-green-700"
                    >
                        Claim Reward!
                    </button>
                )}
            </div>
        </div>
    );
};

export default DailyChallenge;

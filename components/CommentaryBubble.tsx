// components/CommentaryBubble.tsx - Speech bubble for bot trash talk
import React, { useEffect, useState } from 'react';
import { Commentary } from '../core/commentary';

interface CommentaryBubbleProps {
    commentary: Commentary;
    position: 'top' | 'left' | 'right';
    onComplete: () => void;
}

const CommentaryBubble: React.FC<CommentaryBubbleProps> = ({ commentary, position, onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 300); // Wait for fade out
        }, 2500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    // Position styles
    const positionStyles: Record<string, string> = {
        top: 'top-24 left-1/2 -translate-x-1/2',
        left: 'left-28 top-[45%]',
        right: 'right-28 top-[45%]',
    };

    return (
        <div
            className={`absolute ${positionStyles[position]} z-[90] transition-all duration-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
        >
            <div className="relative bg-white text-black px-6 py-3 rounded-2xl shadow-2xl border-4 border-yellow-400 max-w-[200px]">
                {/* Speech bubble tail */}
                <div className={`absolute w-4 h-4 bg-white border-b-4 border-r-4 border-yellow-400 transform rotate-45 ${position === 'top' ? '-bottom-2 left-1/2 -translate-x-1/2' :
                        position === 'left' ? '-left-2 top-1/2 -translate-y-1/2 rotate-[135deg]' :
                            '-right-2 top-1/2 -translate-y-1/2 rotate-[-45deg]'
                    }`} />

                <div className="flex items-center gap-2">
                    <span className="text-2xl">{commentary.emoji}</span>
                    <span className="font-black text-lg">{commentary.text}</span>
                </div>
            </div>
        </div>
    );
};

export default CommentaryBubble;

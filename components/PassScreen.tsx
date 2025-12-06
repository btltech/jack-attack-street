// components/PassScreen.tsx - Transition screen for local multiplayer pass-and-play
import React from 'react';

interface PassScreenProps {
    playerName: string;
    playerAvatar: string;
    onReady: () => void;
}

const PassScreen: React.FC<PassScreenProps> = ({ playerName, playerAvatar, onReady }) => {
    return (
        <div
            className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 flex flex-col items-center justify-center z-[100] cursor-pointer"
            onClick={onReady}
        >
            <div className="text-center text-white">
                <p className="text-2xl font-bold text-pink-200 mb-4 uppercase tracking-widest">Pass the device to</p>

                <div className="mb-8 animate-bounce">
                    <span className="text-[120px] filter drop-shadow-2xl">{playerAvatar}</span>
                </div>

                <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-8">
                    {playerName}
                </h1>

                <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20 inline-block">
                    <p className="text-xl font-bold text-white animate-pulse">
                        👆 Tap when ready to play
                    </p>
                </div>

                <p className="mt-8 text-purple-200 text-sm">
                    Make sure only {playerName} can see the screen!
                </p>
            </div>
        </div>
    );
};

export default PassScreen;

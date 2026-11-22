// components/OnlineLobby.tsx - Shareable room lobby for 2-4 player online games
import React, { useState, useEffect } from 'react';
import { Difficulty } from '../core/types';
import type { View } from '../core/roomEngine';
import type { ConnectionStatus } from '../core/online';
import { getRoomInviteUrl } from '../core/online';
import { playClickSound } from '../core/sounds';

interface OnlineLobbyProps {
  roomCode: string;
  view: View | null;
  status: ConnectionStatus;
  error: string | null;
  onStart: (size: number, difficulty: Difficulty) => void;
  onLeave: () => void;
}

const OnlineLobby: React.FC<OnlineLobbyProps> = ({
  roomCode,
  view,
  status,
  error,
  onStart,
  onLeave,
}) => {
  const [totalSeats, setTotalSeats] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [copied, setCopied] = useState<boolean>(false);

  const inviteUrl = getRoomInviteUrl(roomCode);
  const humans = view ? view.seats.filter(s => !s.isBot) : [];
  const isHost = view?.you === 0;

  // Ensure totalSeats is always at least the number of connected humans
  useEffect(() => {
    if (humans.length > totalSeats) {
      setTotalSeats(Math.min(4, humans.length));
    }
  }, [humans.length, totalSeats]);

  const handleCopyInvite = async () => {
    playClickSound();
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleShareInvite = async () => {
    playClickSound();
    const shareText = `🃏 Come play Jack Attack Street with me! Join Room ${roomCode}:\n${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Jack Attack Street — Room ${roomCode}`,
          text: shareText,
          url: inviteUrl,
        });
        return;
      }
    } catch {
      // fall back to copy
    }
    handleCopyInvite();
  };

  const botsToAdd = Math.max(0, totalSeats - humans.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900 flex flex-col items-center justify-center text-white font-sans relative overflow-x-hidden py-4 px-4">
      <button
        onClick={() => { playClickSound(); onLeave(); }}
        className="fixed top-4 left-4 z-40 bg-black/35 hover:bg-black/55 backdrop-blur-md text-purple-100 hover:text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-full border border-white/20 transition-all shadow-md"
      >
        ← Leave Room
      </button>

      <div className="bg-white/10 backdrop-blur-md px-5 py-6 sm:px-7 sm:py-7 rounded-[2rem] shadow-2xl border-4 border-white/20 text-center max-w-lg w-full z-10">
        <div className="inline-flex items-center gap-2 bg-black/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-purple-200 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-400' : status === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span>{status === 'connected' ? 'Online Room' : status === 'reconnecting' ? 'Reconnecting...' : status === 'error' ? 'Connection Error' : 'Connecting...'}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-widest text-yellow-300 drop-shadow-sm mb-1">
          {roomCode}
        </h1>
        <p className="text-xs sm:text-sm text-purple-200 mb-4">
          Share this code or invite link with friends — no sign-up needed!
        </p>

        {/* Invite Link Buttons */}
        <div className="flex gap-2.5 justify-center mb-5">
          <button
            onClick={handleCopyInvite}
            className="flex-1 bg-purple-500 hover:bg-purple-400 text-white font-bold py-2.5 px-4 rounded-xl border-b-4 border-purple-700 text-sm transition-all active:border-b-0 active:translate-y-0.5"
          >
            {copied ? '✓ Link Copied!' : '📋 Copy Invite Link'}
          </button>
          <button
            onClick={handleShareInvite}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-xl border-b-4 border-blue-700 text-sm transition-all active:border-b-0 active:translate-y-0.5"
          >
            📤 Share
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/90 text-white text-sm font-bold px-4 py-2.5 rounded-xl border border-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Players List */}
        <div className="bg-black/25 rounded-2xl p-4 mb-5 text-left border border-white/10">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
              Players ({humans.length} / {totalSeats})
            </span>
            {botsToAdd > 0 && (
              <span className="text-xs text-yellow-300 font-bold">
                +{botsToAdd} {botsToAdd === 1 ? 'Bot' : 'Bots'} auto-fill
              </span>
            )}
          </div>

          <div className="space-y-2">
            {Array.from({ length: totalSeats }, (_, idx) => {
              const seat = humans[idx];
              if (seat) {
                const isMe = view?.you === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${isMe ? 'bg-yellow-400/20 border-yellow-400/60' : 'bg-white/10 border-white/15'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{idx === 0 ? '👑' : '😎'}</span>
                      <span className="font-bold text-sm sm:text-base">
                        {seat.name} {isMe && <span className="text-yellow-300 text-xs">(You)</span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-500/30 text-green-200 border border-green-400/40">
                      {idx === 0 ? 'Host' : 'Ready'}
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-white/20 bg-white/5 text-purple-200/80"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🤖</span>
                    <span className="font-semibold text-sm">Open Seat (Bot if empty)</span>
                  </div>
                  <span className="text-xs">Waiting...</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Host Controls */}
        {isHost ? (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-purple-200 text-xs mb-1.5 font-bold uppercase tracking-wide">Table Size</p>
                <div className="flex justify-center gap-2">
                  {[2, 3, 4].map(num => {
                    const disabled = num < humans.length;
                    return (
                      <button
                        key={num}
                        disabled={disabled}
                        onClick={() => { playClickSound(); setTotalSeats(num); }}
                        className={`w-12 h-10 rounded-xl font-black text-lg border-b-4 transition-all ${
                          totalSeats === num
                            ? 'bg-yellow-400 border-yellow-600 text-black scale-105'
                            : disabled
                              ? 'bg-indigo-900/50 border-indigo-950 text-indigo-400/40 cursor-not-allowed'
                              : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {botsToAdd > 0 && (
                <div>
                  <p className="text-purple-200 text-xs mb-1.5 font-bold uppercase tracking-wide">Bot Difficulty</p>
                  <div className="flex justify-center gap-1.5">
                    {[
                      { level: Difficulty.Easy, label: 'Easy' },
                      { level: Difficulty.Medium, label: 'Med' },
                      { level: Difficulty.Hard, label: 'Hard' },
                    ].map(({ level, label }) => (
                      <button
                        key={level}
                        onClick={() => { playClickSound(); setDifficulty(level); }}
                        className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs border-b-4 transition-all ${
                          difficulty === level
                            ? 'bg-yellow-400 border-yellow-600 text-black'
                            : 'bg-indigo-700 border-indigo-900 text-indigo-200 hover:bg-indigo-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { playClickSound(); onStart(totalSeats, difficulty); }}
              className="w-full bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-black py-3.5 px-8 rounded-2xl shadow-xl text-xl border-b-4 border-green-800 transition-all hover:scale-[1.02] active:scale-95 active:border-b-0 active:translate-y-1"
            >
              START GAME ▶
            </button>
          </div>
        ) : (
          <div className="bg-indigo-950/60 border border-indigo-400/30 rounded-2xl py-3.5 px-4 text-sm font-bold text-purple-100 animate-pulse">
            ⏳ Waiting for {humans[0]?.name || 'the host'} to start the game...
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineLobby;

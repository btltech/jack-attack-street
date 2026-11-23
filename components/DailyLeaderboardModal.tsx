// components/DailyLeaderboardModal.tsx - Same-Seed Daily Challenge & Live Top 20 Leaderboard
import React, { useState, useEffect } from 'react';
import {
  fetchDailyLeaderboard,
  getTodayUtcKey,
  getMyPlayerId,
  DailyLeaderboardResponse,
} from '../core/dailyLeaderboard';
import { loadNickname, saveNickname } from '../core/online';
import { formatDuration } from '../core/stats';
import { playClickSound } from '../core/sounds';

interface DailyLeaderboardModalProps {
  onClose: () => void;
  onPlayDailySeed: (nickname: string) => void;
}

const DailyLeaderboardModal: React.FC<DailyLeaderboardModalProps> = ({
  onClose,
  onPlayDailySeed,
}) => {
  const today = getTodayUtcKey();
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [board, setBoard] = useState<DailyLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>(() => loadNickname());

  useEffect(() => {
    getMyPlayerId().then(setMyPlayerId).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDailyLeaderboard(today)
      .then((data) => {
        if (active) {
          setBoard(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load leaderboard right now.');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [today]);

  const handleStart = () => {
    playClickSound();
    const clean = nickname.trim() || 'Player';
    saveNickname(clean);
    onPlayDailySeed(clean);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in">
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-5 sm:p-6 rounded-[2rem] max-w-md w-full relative shadow-2xl border-4 border-yellow-400 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl hover:rotate-90 transition-transform"
          aria-label="Close"
        >
          ❌
        </button>

        <div className="text-center mb-4">
          <span className="inline-block bg-yellow-400/20 text-yellow-300 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border border-yellow-400/40 mb-1.5">
            Daily Seed • {today}
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-yellow-400">🏆 Daily Leaderboard</h3>
          <p className="text-xs text-purple-200 mt-1">
            Everyone plays the exact same shuffled deck (2P Medium). Fastest win takes #1!
          </p>
        </div>

        {/* Nickname + Play CTA */}
        <div className="bg-black/25 p-3 rounded-2xl border border-white/15 mb-4 space-y-2.5">
          <input
            type="text"
            maxLength={16}
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); saveNickname(e.target.value); }}
            placeholder="Your leaderboard name (e.g. StreetKing)"
            className="w-full px-3 py-2 rounded-xl bg-indigo-950/80 border border-indigo-400/40 focus:border-yellow-400 focus:outline-none text-white font-bold text-sm placeholder:text-indigo-300/50"
          />
          <button
            onClick={handleStart}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black py-2.5 px-4 rounded-xl border-b-4 border-orange-700 text-base transition-all active:border-b-0 active:translate-y-0.5"
          >
            ⚡ Play Today&apos;s Seed ▶
          </button>
        </div>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto bg-black/20 rounded-2xl p-3 border border-white/10 min-h-[160px]">
          {loading ? (
            <div className="text-center py-8 text-purple-200 text-sm font-bold animate-pulse">
              Loading today&apos;s top times...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-300 text-sm font-bold">{error}</div>
          ) : !board || board.entries.length === 0 ? (
            <div className="text-center py-8 text-purple-200 text-sm">
              <div className="text-3xl mb-2">👑</div>
              <p className="font-bold">No winners yet today!</p>
              <p className="text-xs text-purple-300 mt-1">Be the first to claim #1 on today&apos;s seed.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {board.entries.map((entry) => {
                const isMe = entry.playerId === myPlayerId;
                const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${
                      isMe ? 'bg-yellow-400/25 border border-yellow-400/60' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-black w-7 text-center shrink-0">{medal}</span>
                      <span className="font-bold truncate">
                        {entry.name} {isMe && <span className="text-yellow-300 text-xs">(You)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 text-xs">
                      <span className="font-black text-green-300">{formatDuration(entry.durationMs)}</span>
                      <span className="text-purple-300">{entry.cardsPlayed}c</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {board && board.total > 0 && (
          <p className="text-center text-xs text-purple-300 mt-2.5">
            {board.total} {board.total === 1 ? 'player' : 'players'} beat today&apos;s seed so far
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyLeaderboardModal;

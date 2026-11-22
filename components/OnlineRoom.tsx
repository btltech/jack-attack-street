// components/OnlineRoom.tsx - Connects to an online room and switches between Lobby and Game views
import React from 'react';
import { useOnlineRoom } from '../core/online';
import type { CardTheme } from '../core/themes';
import OnlineLobby from './OnlineLobby';
import OnlineGame from './OnlineGame';

interface OnlineRoomProps {
  roomCode: string;
  nickname: string;
  theme: CardTheme;
  onLeave: () => void;
}

const OnlineRoom: React.FC<OnlineRoomProps> = ({ roomCode, nickname, theme, onLeave }) => {
  const {
    view,
    status,
    error,
    clearError,
    peek,
    clearPeek,
    reactions,
    clockOffsetMs,
    sendStart,
    sendPlay,
    sendDraw,
    sendSuit,
    sendSwap,
    sendReact,
  } = useOnlineRoom(roomCode, nickname);

  if (!view || view.phase === 'lobby') {
    return (
      <OnlineLobby
        roomCode={roomCode}
        view={view}
        status={status}
        error={error}
        onStart={sendStart}
        onLeave={onLeave}
      />
    );
  }

  return (
    <OnlineGame
      view={view}
      theme={theme}
      error={error}
      onClearError={clearError}
      peek={peek}
      onClearPeek={clearPeek}
      reactions={reactions}
      clockOffsetMs={clockOffsetMs}
      onPlay={sendPlay}
      onDraw={sendDraw}
      onChooseSuit={sendSuit}
      onSwap={sendSwap}
      onReact={sendReact}
      onPlayAgain={sendStart}
      onLeave={onLeave}
    />
  );
};

export default OnlineRoom;

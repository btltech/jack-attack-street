// components/OnlineRoom.tsx - Connects to an online room and switches between Lobby and Game views
import React from 'react';
import { useOnlineRoom } from '../core/online';
import OnlineLobby from './OnlineLobby';
import OnlineGame from './OnlineGame';

interface OnlineRoomProps {
  roomCode: string;
  nickname: string;
  onLeave: () => void;
}

const OnlineRoom: React.FC<OnlineRoomProps> = ({ roomCode, nickname, onLeave }) => {
  const {
    view,
    status,
    error,
    clearError,
    peek,
    clearPeek,
    clockOffsetMs,
    sendStart,
    sendPlay,
    sendDraw,
    sendSuit,
    sendSwap,
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
      error={error}
      onClearError={clearError}
      peek={peek}
      onClearPeek={clearPeek}
      clockOffsetMs={clockOffsetMs}
      onPlay={sendPlay}
      onDraw={sendDraw}
      onChooseSuit={sendSuit}
      onSwap={sendSwap}
      onPlayAgain={sendStart}
      onLeave={onLeave}
    />
  );
};

export default OnlineRoom;

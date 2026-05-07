import React, { useState } from 'react';
import { Users, X, LogIn, Plus } from 'lucide-react';
import './MultiplayerLobby.css';

interface MultiplayerLobbyProps {
  onClose: () => void;
  onJoinRoom: (roomId: string) => void;
  currentRoomId: string | null;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onClose, onJoinRoom, currentRoomId }) => {
  const [roomInput, setRoomInput] = useState('');

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinRoom(newRoomId);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      onJoinRoom(roomInput.trim().toUpperCase());
    }
  };

  return (
    <div className="wb-modal-overlay">
      <div className="wb-modal glass-panel">
        <button className="wb-modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="wb-modal-header">
          <Users size={24} className="wb-modal-icon" />
          <h2>Multiplayer Lab</h2>
        </div>

        {currentRoomId ? (
          <div className="wb-multiplayer-active">
            <p>You are connected to Room:</p>
            <h3 className="wb-room-code">{currentRoomId}</h3>
            <p className="wb-room-help">Share this code with your lab partner so they can join your session. Their actions will appear in real-time.</p>
            <button className="wb-btn wb-btn-secondary" onClick={() => onJoinRoom('')}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="wb-multiplayer-setup">
            <div className="wb-setup-card" onClick={handleCreateRoom}>
              <Plus size={32} />
              <h3>Host Session</h3>
              <p>Create a new room and invite your partner</p>
            </div>

            <div className="wb-setup-divider"><span>OR</span></div>

            <form className="wb-setup-form" onSubmit={handleJoinRoom}>
              <h3>Join Session</h3>
              <div className="wb-input-group">
                <input 
                  type="text" 
                  placeholder="Enter 6-character Room Code" 
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  maxLength={6}
                />
                <button type="submit" className="wb-btn wb-btn-primary" disabled={roomInput.length < 3}>
                  <LogIn size={18} /> Join
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

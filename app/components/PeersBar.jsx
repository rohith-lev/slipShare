'use client';

import React, { useState } from 'react';
import { Smartphone, Laptop, Edit3, Check, RefreshCw } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function PeersBar({
  networkInfo,
  connectedDevices = [],
  deviceName,
  setDeviceName,
  deviceType = 'desktop',
  wsStatus = 'connecting',
  onNameChange,
  isMuted,
  onOpenQr,
  onReconnect,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(deviceName);

  const handleSaveName = () => {
    const name = tempName.trim();
    if (name) {
      setDeviceName(name);
      onNameChange(name);
    }
    setIsEditing(false);
    playTapSound(isMuted);
  };

  const isConnected = wsStatus === 'connected';
  const isConnecting = wsStatus === 'connecting';
  const isDisconnected = wsStatus === 'disconnected';

  // Count peers that are NOT self
  const peers = connectedDevices.filter((d) => !d.isSelf);
  const totalCount = connectedDevices.length;

  const statusText = (() => {
    if (isConnecting) return 'Connecting to local network…';
    if (isDisconnected) return 'Disconnected — tap Retry to reconnect';
    // Connected
    if (peers.length === 0) return 'Just you on this network · Waiting for peers';
    if (peers.length === 1) return `2 devices connected · 1 peer active`;
    return `${totalCount} devices connected · ${peers.length} peers`;
  })();

  return (
    <div className="peers-strip glass-panel">
      {/* Left — network status indicator */}
      <div className="radar-indicator">
        <div className="radar-ping-wrapper">
          <div className={`radar-pulse status-${wsStatus}`} />
          <div className={`radar-core status-${wsStatus}`} />
        </div>
        <div className="radar-info">
          <div className="radar-title-row">
            <span className="radar-title">Local Network</span>
            {networkInfo?.localIp && (
              <span className="radar-ip-tag">
                ({networkInfo.localIp}:{networkInfo.port || 3000})
              </span>
            )}
          </div>
          <div className="radar-status-row">
            <span className={`radar-status-text${isConnecting ? ' status-connecting' : isDisconnected ? ' status-disconnected' : ''}`}>
              {statusText}
            </span>
            {isDisconnected && (
              <button
                onClick={onReconnect}
                className="radar-reconnect-btn"
                title="Reconnect to local network"
              >
                <RefreshCw size={11} />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right — device list */}
      <div className="devices-list">
        {/* Self badge */}
        <div className="device-badge self">
          {deviceType === 'mobile' ? (
            <Smartphone size={14} color="var(--blip-blue)" />
          ) : (
            <Laptop size={14} color="var(--blip-blue)" />
          )}

          {isEditing ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
                className="name-edit-input"
                maxLength={28}
              />
              <button
                onClick={handleSaveName}
                className="name-save-btn"
                title="Save name"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <span
              onClick={() => {
                setTempName(deviceName);
                setIsEditing(true);
              }}
              title="Tap to rename this device"
              className="name-display-wrap"
            >
              <span>{deviceName} (You)</span>
              <Edit3 size={11} style={{ opacity: 0.5 }} />
            </span>
          )}
        </div>

        {/* Peer badges */}
        {peers.map((peer) => (
          <div
            key={peer.id}
            className="device-badge peer"
            title={`Connected since ${new Date(peer.joinedAt).toLocaleTimeString()}`}
          >
            {peer.type === 'mobile' ? (
              <Smartphone size={14} color="var(--blip-purple)" />
            ) : (
              <Laptop size={14} color="var(--blip-purple)" />
            )}
            <span>{peer.name}</span>
          </div>
        ))}

        {/* Pair button when no peers yet */}
        {peers.length === 0 && (
          <button
            onClick={() => {
              playTapSound(isMuted);
              onOpenQr();
            }}
            className="pair-phone-pill"
          >
            + Pair Phone
          </button>
        )}
      </div>
    </div>
  );
}

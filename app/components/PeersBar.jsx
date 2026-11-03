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
  wsStatus = 'connected',
  onNameChange,
  isMuted,
  onOpenQr,
  onReconnect,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(deviceName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      setDeviceName(tempName.trim());
      onNameChange(tempName.trim());
    }
    setIsEditing(false);
    playTapSound(isMuted);
  };

  const isConnected = wsStatus === 'connected';
  const isConnecting = wsStatus === 'connecting';
  const isDisconnected = wsStatus === 'disconnected';

  return (
    <div className="peers-strip glass-panel">
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
            <span className={`radar-status-text status-${wsStatus}`}>
              {isConnecting && 'Connecting to local network...'}
              {isDisconnected && 'Disconnected • Reconnecting...'}
              {isConnected && (
                connectedDevices.length <= 1
                  ? '1 device connected (You) • Ready for peers'
                  : `${connectedDevices.length} active devices connected`
              )}
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

      <div className="devices-list">
        {/* Self device badge */}
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
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                className="name-edit-input"
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
              title="Click to rename your device"
              className="name-display-wrap"
            >
              <span>{deviceName} (You)</span>
              <Edit3 size={11} style={{ opacity: 0.6 }} />
            </span>
          )}
        </div>

        {/* Other Peers on the Wi-Fi */}
        {connectedDevices
          .filter((d) => !d.isSelf)
          .map((peer) => (
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

        {connectedDevices.length <= 1 && (
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

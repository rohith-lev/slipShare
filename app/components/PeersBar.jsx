'use client';

import React, { useState } from 'react';
import { Wifi, Smartphone, Laptop, Edit3, Check } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function PeersBar({
  networkInfo,
  connectedDevices = [],
  deviceName,
  setDeviceName,
  onNameChange,
  isMuted,
  onOpenQr,
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

  return (
    <div className="peers-strip glass-panel">
      <div className="radar-indicator">
        <div className="radar-ping-wrapper">
          <div className="radar-pulse" />
          <div className="radar-core" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', fontWeight: '700' }}>
            <span>Local Network</span>
            {networkInfo?.localIp && (
              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                ({networkInfo.localIp}:{networkInfo.port})
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {connectedDevices.length} active device{connectedDevices.length !== 1 ? 's' : ''} connected
          </span>
        </div>
      </div>

      <div className="devices-list">
        {/* Self device badge */}
        <div className="device-badge self">
          {deviceName.toLowerCase().includes('phone') || deviceName.toLowerCase().includes('mobile') || deviceName.toLowerCase().includes('iphone') || deviceName.toLowerCase().includes('android') ? (
            <Smartphone size={14} color="var(--blip-blue)" />
          ) : (
            <Laptop size={14} color="var(--blip-blue)" />
          )}

          {isEditing ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                autoFocus
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--blip-blue)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100px',
                }}
              />
              <button
                onClick={handleSaveName}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent-success)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <span
              onClick={() => {
                setTempName(deviceName);
                setIsEditing(true);
              }}
              title="Click to rename your device"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {deviceName} (You)
              <Edit3 size={11} style={{ opacity: 0.6 }} />
            </span>
          )}
        </div>

        {/* Other Peers */}
        {connectedDevices
          .filter(d => !d.isSelf)
          .map(peer => (
            <div key={peer.id} className="device-badge" title={`Connected since ${new Date(peer.joinedAt).toLocaleTimeString()}`}>
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
            style={{
              background: 'transparent',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '0.3rem 0.75rem',
              fontSize: '0.76rem',
              color: 'var(--blip-blue)',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            + Pair Phone
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { QrCode, Volume2, VolumeX, Sun, Moon, Wifi } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function Header({
  theme,
  setTheme,
  isMuted,
  setIsMuted,
  onOpenQr,
  connectedCount = 1,
}) {
  const toggleTheme = () => {
    playTapSound(isMuted);
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSound = () => {
    playTapSound(false);
    setIsMuted(prev => !prev);
  };

  return (
    <header className="app-header glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <a href="/" className="blip-wordmark">
          slipshare
          <span className="blip-wordmark-dot" />
        </a>
      </div>

      <div className="header-actions">
        {/* Device Pairing button */}
        <button
          className="primary-btn"
          onClick={() => {
            playTapSound(isMuted);
            onOpenQr();
          }}
          title="Connect mobile device via QR"
        >
          <QrCode size={16} />
          <span>Pair Device</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          className="icon-btn"
          onClick={toggleSound}
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label="Toggle sound"
        >
          {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        {/* Theme Toggle */}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
    </header>
  );
}

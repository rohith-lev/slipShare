'use client';

import React from 'react';
import { QrCode, Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function Header({
  theme,
  setTheme,
  isMuted,
  setIsMuted,
  onOpenQr,
}) {
  const toggleTheme = () => {
    playTapSound(isMuted);
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSound = () => {
    playTapSound(false);
    setIsMuted((prev) => !prev);
  };

  return (
    <header className="app-header glass-panel">
      <div className="header-brand">
        <a href="/" className="blip-wordmark">
          <img
            src="/icons/ic_app_decorated.svg"
            alt="slipshare logo"
            className="brand-logo"
          />
          <span className="brand-title">slipshare</span>
          <span className="blip-wordmark-dot" />
        </a>
      </div>

      <div className="header-actions">
        {/* Device Pairing button */}
        <button
          className="primary-btn header-pair-btn"
          onClick={() => {
            playTapSound(isMuted);
            onOpenQr();
          }}
          title="Connect mobile device via QR"
        >
          <QrCode size={15} />
          <span className="pair-text-desktop">Pair Device</span>
          <span className="pair-text-mobile">Pair</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          className="icon-btn"
          onClick={toggleSound}
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label="Toggle sound"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Theme Toggle */}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
}

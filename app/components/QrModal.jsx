'use client';

import React, { useState } from 'react';
import { X, Copy, Check, QrCode, Wifi, ShieldCheck, Smartphone } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function QrModal({ isOpen, onClose, networkInfo, isMuted, triggerToast }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const connectUrl = networkInfo?.connectUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(connectUrl);
    setCopied(true);
    playTapSound(isMuted);
    triggerToast('Network URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel-elevated modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(19, 181, 234, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--blip-blue)',
              }}
            >
              <QrCode size={18} />
            </div>
            <div className="modal-title">Pair Mobile Device</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* QR Code Container */}
        {networkInfo?.qrDataUrl ? (
          <div className="qr-box-wrap">
            <img src={networkInfo.qrDataUrl} alt="Pairing QR Code" />
          </div>
        ) : (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <Smartphone size={32} style={{ color: 'var(--blip-blue)', margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Open the URL on your mobile browser</p>
          </div>
        )}

        {/* URL Pill */}
        <div className="url-copy-pill">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {connectUrl}
          </span>
          <button
            onClick={handleCopyUrl}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 4px',
            }}
            title="Copy URL"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={14} color="var(--blip-blue)" />
            <span>Connect your phone to the same Wi-Fi network</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={14} color="var(--accent-success)" />
            <span>Zero cloud intermediary • Direct peer-to-peer Wi-Fi speed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Wifi, ShieldCheck, Smartphone } from 'lucide-react';
import qrcode from 'qrcode';
import { playTapSound } from '../utils/sound';

export default function QrModal({ isOpen, onClose, networkInfo, isMuted, triggerToast }) {
  const [copied, setCopied] = useState(false);
  const [clientQrUrl, setClientQrUrl] = useState('');
  const [selectedIp, setSelectedIp] = useState('');

  // Determine working connection URL
  const determineConnectUrl = () => {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname;
    // If accessing via domain or external IP (ngrok, custom domain, or direct IP)
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
    if (selectedIp) {
      return `http://${selectedIp}:${networkInfo?.port || 3000}`;
    }
    return networkInfo?.connectUrl || window.location.origin;
  };

  const connectUrl = determineConnectUrl();

  // Generate QR code dynamically for the exact connectUrl
  useEffect(() => {
    if (!isOpen || !connectUrl) return;

    qrcode.toDataURL(connectUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0B0B0F',
        light: '#FFFFFF',
      },
    })
      .then((url) => setClientQrUrl(url))
      .catch(() => setClientQrUrl(networkInfo?.qrDataUrl || ''));
  }, [isOpen, connectUrl, networkInfo?.qrDataUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    if (!connectUrl) return;
    navigator.clipboard.writeText(connectUrl);
    setCopied(true);
    playTapSound(isMuted);
    triggerToast('Network URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const displayQr = clientQrUrl || networkInfo?.qrDataUrl;

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
        {displayQr ? (
          <div className="qr-box-wrap">
            <img src={displayQr} alt="Pairing QR Code" />
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
            <p style={{ fontSize: '0.85rem' }}>Open the URL below on your mobile browser</p>
          </div>
        )}

        {/* Multiple IPs selector if available */}
        {networkInfo?.allIps && networkInfo.allIps.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>Network Adapter:</span>
            {networkInfo.allIps.map((ip) => (
              <button
                key={ip.address}
                onClick={() => setSelectedIp(ip.address)}
                style={{
                  background: (selectedIp === ip.address || (!selectedIp && ip.address === networkInfo.localIp)) ? 'var(--blip-blue)' : 'var(--bg-subtle)',
                  color: (selectedIp === ip.address || (!selectedIp && ip.address === networkInfo.localIp)) ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 8px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                {ip.name} ({ip.address})
              </button>
            ))}
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

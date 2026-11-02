'use client';

import React from 'react';
import { X, Download } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function PreviewModal({ previewUrl, onClose, isMuted }) {
  if (!previewUrl) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: 'absolute',
            top: '-2.5rem',
            right: 0,
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <a
            href={previewUrl}
            download="slipshare-image"
            className="icon-btn"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none' }}
            title="Download image"
            onClick={() => playTapSound(isMuted)}
          >
            <Download size={18} />
          </a>
          <button
            className="icon-btn"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none' }}
            onClick={onClose}
            title="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <img
          src={previewUrl}
          alt="Preview"
          style={{
            maxWidth: '100%',
            maxHeight: '82vh',
            borderRadius: '12px',
            objectFit: 'contain',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          }}
        />
      </div>
    </div>
  );
}

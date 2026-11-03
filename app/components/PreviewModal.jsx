'use client';

import React from 'react';
import { X, Download } from 'lucide-react';
import { playTapSound } from '../utils/sound';

export default function PreviewModal({ previewUrl, onClose, isMuted }) {
  if (!previewUrl) return null;

  return (
    <div className="modal-overlay preview-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="preview-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="preview-top-bar">
          <a
            href={previewUrl}
            download="slipshare-image"
            className="icon-btn preview-btn"
            title="Download image"
            onClick={() => playTapSound(isMuted)}
          >
            <Download size={18} />
          </a>
          <button
            className="icon-btn preview-btn"
            onClick={onClose}
            title="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <img
          src={previewUrl}
          alt="Preview"
          className="preview-image"
        />
      </div>
    </div>
  );
}

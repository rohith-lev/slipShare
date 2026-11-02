'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Link as LinkIcon,
  Camera,
  Send,
  Sparkles,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { playTapSound, playBlipSound } from '../utils/sound';

export default function Composer({
  activeTab,
  setActiveTab,
  onUploadFiles,
  onSendText,
  onSendLink,
  isUploading,
  uploadProgress,
  isMuted,
  triggerToast,
}) {
  const [textContent, setTextContent] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (!textContent.trim()) return;
    onSendText(textContent.trim());
    setTextContent('');
    playBlipSound(isMuted);
    triggerToast('Text note sent to all devices');
  };

  const handleLinkSubmit = (e) => {
    e?.preventDefault();
    if (!linkContent.trim()) return;
    let url = linkContent.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    onSendLink(url);
    setLinkContent('');
    playBlipSound(isMuted);
    triggerToast('Link broadcast to connected devices');
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* Tab Switcher */}
      <div className="composer-tabs">
        <button
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('files');
          }}
        >
          <UploadCloud size={16} />
          <span>Files & Media</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('camera');
            cameraInputRef.current?.click();
          }}
        >
          <Camera size={16} />
          <span>Camera</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('text');
          }}
        >
          <FileText size={16} />
          <span>Quick Note</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'link' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('link');
          }}
        >
          <LinkIcon size={16} />
          <span>Share Link</span>
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelect}
        accept="image/*,video/*"
        capture="environment"
        style={{ display: 'none' }}
      />

      {/* Uploading progress indicator */}
      {isUploading && (
        <div className="glass-panel-elevated progress-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Transferring to peers...</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--blip-blue)' }}>
              {uploadProgress}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* TAB 1: File Dropzone */}
      {activeTab === 'files' && (
        <div
          className={`dropzone ${isDragOver ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon-ring">
            <UploadCloud size={32} />
          </div>
          <div className="dropzone-title">Drop files here or click to browse</div>
          <div className="dropzone-desc">
            Direct peer transfer at maximum local Wi-Fi speed. Original quality, no compression, no cloud storage.
          </div>
          <div className="dropzone-badge">
            <Sparkles size={12} color="var(--blip-blue)" />
            <span>Unlimited file size • All formats accepted</span>
          </div>
        </div>
      )}

      {/* TAB 2: Camera Capture */}
      {activeTab === 'camera' && (
        <div
          className="dropzone"
          onClick={() => cameraInputRef.current?.click()}
          style={{ borderColor: 'var(--blip-purple)' }}
        >
          <div className="dropzone-icon-ring" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--blip-purple)' }}>
            <Camera size={32} />
          </div>
          <div className="dropzone-title">Take Photo or Record Video</div>
          <div className="dropzone-desc">
            Instantly snap a picture or record video on your phone and stream it directly to your laptop.
          </div>
          <button className="primary-btn" style={{ marginTop: '0.5rem' }}>
            Open Camera
          </button>
        </div>
      )}

      {/* TAB 3: Text Note */}
      {activeTab === 'text' && (
        <div className="text-composer">
          <textarea
            className="composer-textarea"
            placeholder="Type or paste text, codes, clipboard notes, Wi-Fi keys, or addresses to share instantly..."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleTextSubmit();
              }
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Press <kbd style={{ padding: '2px 5px', background: 'var(--bg-subtle)', borderRadius: '4px' }}>Ctrl + Enter</kbd> to broadcast
            </span>
            <button
              className="primary-btn"
              onClick={handleTextSubmit}
              disabled={!textContent.trim()}
              style={{ opacity: textContent.trim() ? 1 : 0.6 }}
            >
              <Send size={15} />
              <span>Send Note</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Share Link */}
      {activeTab === 'link' && (
        <div className="text-composer">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="composer-input"
              placeholder="Paste any URL (e.g. youtube.com, github.com, article)..."
              value={linkContent}
              onChange={(e) => setLinkContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
            />
            <button
              className="primary-btn"
              onClick={handleLinkSubmit}
              disabled={!linkContent.trim()}
              style={{ flexShrink: 0, opacity: linkContent.trim() ? 1 : 0.6 }}
            >
              <ArrowUpRight size={16} />
              <span>Broadcast Link</span>
            </button>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Links can be opened with one click on any paired mobile or laptop device.
          </span>
        </div>
      )}
    </div>
  );
}

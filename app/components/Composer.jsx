'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Link as LinkIcon,
  Camera,
  Send,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { playTapSound, playOutSound } from '../utils/sound';

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
      const validFiles = Array.from(e.dataTransfer.files).filter((f) => f.name);
      if (validFiles.length > 0) {
        onUploadFiles(validFiles);
      }
    }
  };

  const handleFileSelect = (e) => {
    const input = e.target;
    if (input.files && input.files.length > 0) {
      const selectedFiles = Array.from(input.files);
      onUploadFiles(selectedFiles);
      // Asynchronously reset value so mobile browsers don't revoke file descriptors
      setTimeout(() => {
        try {
          input.value = '';
        } catch {
          // ignore
        }
      }, 800);
    }
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (!textContent.trim()) return;
    onSendText(textContent.trim());
    setTextContent('');
    playOutSound(isMuted);
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
    playOutSound(isMuted);
    triggerToast('Link broadcast to connected devices');
  };

  return (
    <div className="composer-container glass-panel">
      {/* Tab Switcher: 4 cleanly proportioned tabs for both desktop & mobile */}
      <div className="composer-tabs">
        <button
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('files');
          }}
        >
          <UploadCloud size={16} />
          <span className="tab-label-desktop">Files & Media</span>
          <span className="tab-label-mobile">Files</span>
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
          <span className="tab-label-desktop">Camera</span>
          <span className="tab-label-mobile">Camera</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('text');
          }}
        >
          <FileText size={16} />
          <span className="tab-label-desktop">Quick Note</span>
          <span className="tab-label-mobile">Note</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'link' ? 'active' : ''}`}
          onClick={() => {
            playTapSound(isMuted);
            setActiveTab('link');
          }}
        >
          <LinkIcon size={16} />
          <span className="tab-label-desktop">Share Link</span>
          <span className="tab-label-mobile">Link</span>
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
            <UploadCloud size={30} />
          </div>
          <div className="dropzone-title">
            <span className="dropzone-title-desktop">Drop files here or click to browse</span>
            <span className="dropzone-title-mobile">Tap to choose files or photos</span>
          </div>
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
          className="dropzone camera-dropzone"
          onClick={() => cameraInputRef.current?.click()}
        >
          <div className="dropzone-icon-ring camera-ring">
            <Camera size={30} />
          </div>
          <div className="dropzone-title">Take Photo or Record Video</div>
          <div className="dropzone-desc">
            Instantly snap a picture or record video on your phone and stream it directly to your laptop.
          </div>
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: '0.5rem' }}
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
          >
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
          <div className="composer-footer">
            <span className="composer-hint">
              Press <kbd>Ctrl + Enter</kbd> to broadcast
            </span>
            <button
              className="primary-btn composer-send-btn"
              onClick={handleTextSubmit}
              disabled={!textContent.trim()}
            >
              <Send size={14} />
              <span>Send Note</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Share Link */}
      {activeTab === 'link' && (
        <div className="text-composer">
          <div className="link-composer-row">
            <input
              type="text"
              className="composer-input"
              placeholder="Paste any URL (e.g. youtube.com, github.com)..."
              value={linkContent}
              onChange={(e) => setLinkContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
            />
            <button
              className="primary-btn composer-send-btn link-broadcast-btn"
              onClick={handleLinkSubmit}
              disabled={!linkContent.trim()}
            >
              <ArrowUpRight size={15} />
              <span>Broadcast Link</span>
            </button>
          </div>
          <span className="composer-hint">
            Links can be opened with one click on any paired mobile or laptop device.
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  FileText,
  Link as LinkIcon,
  Download,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  File,
  Image as ImageIcon,
  Film,
  Music,
  Clock,
  Laptop,
  Smartphone,
  Eye,
} from 'lucide-react';
import { playTapSound, playBlipSound } from '../utils/sound';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

export default function ActivityFeed({
  items = [],
  onDeleteItem,
  onClearAll,
  onPreviewImage,
  isMuted,
  triggerToast,
}) {
  const [filter, setFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'files') return item.type === 'file';
    if (filter === 'notes') return item.type === 'text';
    if (filter === 'links') return item.type === 'link';
    return true;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    playTapSound(isMuted);
    triggerToast('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Feed Header */}
      <div className="feed-header">
        <div className="feed-title-wrap">
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Shared Activity</h2>
          <span className="feed-count-pill">{items.length}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="feed-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setFilter('all');
              }}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'files' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setFilter('files');
              }}
            >
              Files
            </button>
            <button
              className={`filter-btn ${filter === 'notes' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setFilter('notes');
              }}
            >
              Notes
            </button>
            <button
              className={`filter-btn ${filter === 'links' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setFilter('links');
              }}
            >
              Links
            </button>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all transfer history?')) {
                  onClearAll();
                  playTapSound(isMuted);
                  triggerToast('History cleared');
                }
              }}
              className="icon-btn"
              title="Clear all history"
              style={{ width: '32px', height: '32px' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Feed List */}
      {filteredItems.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-icon-wrap">
            <Clock size={26} />
          </div>
          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>No shared items yet</div>
          <p style={{ fontSize: '0.84rem', maxWidth: '320px' }}>
            Drop files or paste text/links above to transfer them in real-time to your other devices.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {filteredItems.map((item) => {
            const isImage = item.type === 'file' && item.fileType === 'image';
            const isVideo = item.type === 'file' && item.fileType === 'video';
            const isAudio = item.type === 'file' && item.fileType === 'audio';

            return (
              <div key={item.id} className="glass-panel feed-card">
                <div className="item-left">
                  {/* Visual Indicator or Thumbnail */}
                  {isImage ? (
                    <div
                      className="image-thumbnail-box"
                      onClick={() => onPreviewImage(item.viewUrl)}
                      title="Click to view image"
                    >
                      <img src={item.viewUrl} alt={item.originalName} loading="lazy" />
                    </div>
                  ) : (
                    <div className={`item-icon-box ${item.type} ${item.fileType || ''}`}>
                      {item.type === 'text' && <FileText size={20} />}
                      {item.type === 'link' && <LinkIcon size={20} />}
                      {item.type === 'file' && (
                        <>
                          {isVideo && <Film size={20} />}
                          {isAudio && <Music size={20} />}
                          {!isVideo && !isAudio && <File size={20} />}
                        </>
                      )}
                    </div>
                  )}

                  {/* Content & Meta */}
                  <div className="item-content-wrap">
                    {item.type === 'file' && (
                      <>
                        <div className="item-title">{item.originalName}</div>
                        {isVideo && (
                          <video
                            src={item.viewUrl}
                            controls
                            style={{
                              maxWidth: '100%',
                              maxHeight: '260px',
                              borderRadius: '8px',
                              marginTop: '0.35rem',
                              background: '#000',
                            }}
                          />
                        )}
                        {isAudio && (
                          <audio
                            src={item.viewUrl}
                            controls
                            style={{ width: '100%', marginTop: '0.35rem' }}
                          />
                        )}
                      </>
                    )}

                    {item.type === 'text' && (
                      <div className="item-snippet">{item.content}</div>
                    )}

                    {item.type === 'link' && (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: '600',
                          color: 'var(--blip-blue)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          wordBreak: 'break-all',
                        }}
                      >
                        {item.content}
                        <ExternalLink size={13} />
                      </a>
                    )}

                    {/* Metadata line */}
                    <div className="item-meta">
                      {item.type === 'file' && <span>{formatBytes(item.size)}</span>}
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {item.senderType === 'mobile' ? (
                          <Smartphone size={11} />
                        ) : (
                          <Laptop size={11} />
                        )}
                        {item.senderName}
                      </span>
                      <span>•</span>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="item-actions">
                  {/* File Download */}
                  {item.type === 'file' && (
                    <a
                      href={item.downloadUrl}
                      download={item.originalName}
                      className="icon-btn"
                      title="Download original file"
                      onClick={() => playTapSound(isMuted)}
                    >
                      <Download size={16} />
                    </a>
                  )}

                  {/* Image View */}
                  {isImage && (
                    <button
                      className="icon-btn"
                      onClick={() => onPreviewImage(item.viewUrl)}
                      title="View Image"
                    >
                      <Eye size={16} />
                    </button>
                  )}

                  {/* Copy Text or Link */}
                  {(item.type === 'text' || item.type === 'link') && (
                    <button
                      className="icon-btn"
                      onClick={() => handleCopy(item.content, item.id)}
                      title="Copy to clipboard"
                    >
                      {copiedId === item.id ? (
                        <Check size={16} color="var(--accent-success)" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  )}

                  {/* Delete Item */}
                  <button
                    className="icon-btn"
                    onClick={() => {
                      onDeleteItem(item.id);
                      playTapSound(isMuted);
                      triggerToast('Item removed');
                    }}
                    title="Delete item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

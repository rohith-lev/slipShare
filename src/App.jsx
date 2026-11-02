import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Smartphone,
  Laptop,
  QrCode,
  UploadCloud,
  FileText,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  Trash2,
  ExternalLink,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Camera,
  Layers,
  ArrowRight,
  X,
  File,
  Image as ImageIcon,
  Film,
  Music,
  Send,
  Sparkles
} from 'lucide-react';
import { playBlipSound, playTapSound } from './utils/sound';

export default function App() {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'text' | 'link'
  const [feedFilter, setFeedFilter] = useState('all'); // 'all' | 'file' | 'text' | 'link'
  
  // Composer state
  const [textContent, setTextContent] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Settings & UI state
  const [theme, setTheme] = useState(localStorage.getItem('blip_theme') || 'light');
  const [isMuted, setIsMuted] = useState(localStorage.getItem('blip_muted') === 'true');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Device detection
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(navigator.userAgent);
  const [deviceName, setDeviceName] = useState(
    localStorage.getItem('blip_device_name') || (isMobile ? 'Mobile Phone' : 'Laptop')
  );

  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Sync theme to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('blip_theme', theme);
  }, [theme]);

  // Sync sound settings
  useEffect(() => {
    localStorage.setItem('blip_muted', isMuted);
  }, [isMuted]);

  // Toast trigger
  const triggerToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Network Info & QR
  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (e) {
      console.warn('Network info fetch error:', e);
    }
  };

  // Initial Fetch & WebSocket setup
  useEffect(() => {
    fetchNetworkInfo();

    // Fetch existing items
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.items) setItems(data.items);
      })
      .catch(console.warn);

    // Setup WebSocket
    let reconnectTimer;
    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send our device name
        ws.send(JSON.stringify({ type: 'set_name', name: deviceName }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'welcome') {
            if (msg.items) setItems(msg.items);
          } else if (msg.type === 'devices_updated') {
            setConnectedDevices(msg.devices || []);
          } else if (msg.type === 'item_received') {
            setItems(prev => {
              if (prev.some(i => i.id === msg.item.id)) return prev;
              return [msg.item, ...prev];
            });
            playBlipSound(isMuted);
            triggerToast(`Received new ${msg.item.type} from ${msg.item.senderName}!`);
          } else if (msg.type === 'item_deleted') {
            setItems(prev => prev.filter(i => i.id !== msg.itemId));
          } else if (msg.type === 'history_cleared') {
            setItems([]);
            triggerToast('Transfer history cleared');
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connectWs, 2500);
      };
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Update device name in WS
  useEffect(() => {
    localStorage.setItem('blip_device_name', deviceName);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_name', name: deviceName }));
    }
  }, [deviceName]);

  // Handle File Uploads
  const handleUploadFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    setIsUploading(true);
    setUploadProgress(10);
    playTapSound(isMuted);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('senderName', deviceName);
    formData.append('senderType', isMobile ? 'mobile' : 'desktop');

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(0);
        if (xhr.status === 201) {
          triggerToast(`Sent ${files.length} file${files.length > 1 ? 's' : ''} successfully!`);
          playBlipSound(isMuted);
        } else {
          triggerToast('File upload failed. Please try again.');
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        triggerToast('Network error during file upload');
      };

      xhr.send(formData);
    } catch (e) {
      setIsUploading(false);
      setUploadProgress(0);
      triggerToast('Error preparing file upload');
    }
  };

  // Send Text Note
  const handleSendText = async (e) => {
    if (e) e.preventDefault();
    if (!textContent.trim()) return;
    playTapSound(isMuted);

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content: textContent.trim(),
          senderName: deviceName,
          senderType: isMobile ? 'mobile' : 'desktop'
        })
      });
      if (res.ok) {
        setTextContent('');
        triggerToast('Text sent to all devices!');
        playBlipSound(isMuted);
      }
    } catch (err) {
      triggerToast('Failed to send text');
    }
  };

  // Send Link
  const handleSendLink = async (e) => {
    if (e) e.preventDefault();
    let url = linkContent.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    playTapSound(isMuted);

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'link',
          content: url,
          title: url,
          senderName: deviceName,
          senderType: isMobile ? 'mobile' : 'desktop'
        })
      });
      if (res.ok) {
        setLinkContent('');
        triggerToast('Link shared instantly!');
        playBlipSound(isMuted);
      }
    } catch (err) {
      triggerToast('Failed to send link');
    }
  };

  // Delete Item
  const handleDeleteItem = async (id) => {
    playTapSound(isMuted);
    try {
      await fetch(`/api/items/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete item:', e);
    }
  };

  // Clear All
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all shared items?')) return;
    playTapSound(isMuted);
    try {
      await fetch('/api/items', { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to clear items:', e);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text, id) => {
    playTapSound(isMuted);
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    if (feedFilter === 'all') return true;
    return item.type === feedFilter;
  });

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format timestamp
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="app-container">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleUploadFiles(e.target.files)}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleUploadFiles(e.target.files)}
      />

      {/* Header */}
      <header className="app-header glass-panel">
        <div className="brand-section">
          <div className="brand-logo-wrap">
            <Wifi size={22} />
            <div className="pulse-dot" />
          </div>
          <div className="brand-title-wrap">
            <h1>
              BlipShare
              <span className="brand-badge">Local Drop</span>
            </h1>
            <p className="brand-subtitle">Gentle & instant peer sync for Mobile & Laptop</p>
          </div>
        </div>

        <div className="header-controls">
          <button
            className="device-pill"
            title="Your Device Name (Click to edit)"
            onClick={() => {
              const newName = prompt('Enter a name for this device:', deviceName);
              if (newName && newName.trim()) setDeviceName(newName.trim());
            }}
          >
            {isMobile ? <Smartphone size={15} /> : <Laptop size={15} />}
            <span>{deviceName}</span>
            <div className="device-dot" />
          </button>

          <button
            className="icon-button"
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            onClick={() => {
              playTapSound(!isMuted);
              setIsMuted(!isMuted);
            }}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <button
            className="icon-button"
            title="Toggle theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>

      {/* Connection & Network Banner */}
      <section className="connect-banner glass-panel">
        <div className="connect-left">
          <h2 className="connect-heading">
            <Sparkles size={18} color="var(--primary)" />
            Instant Mobile Connection
          </h2>
          <p className="connect-desc">
            Keep this laptop tab open. Open your phone camera and scan the QR code to connect immediately — no app download or sign-in needed.
          </p>
          {networkInfo && (
            <div className="connect-url-bar">
              <span>{networkInfo.connectUrl}</span>
            </div>
          )}
        </div>

        <div className="connect-right">
          <button
            className="qr-trigger-btn"
            onClick={() => {
              playTapSound(isMuted);
              setShowQrModal(true);
            }}
          >
            <QrCode size={18} />
            <span>Show QR Code</span>
          </button>
        </div>
      </section>

      {/* Connected Peers Radar Bar */}
      <div className="peers-bar glass-panel">
        <span className="peers-label">Nearby Devices:</span>
        <div className="peers-list">
          {connectedDevices.length === 0 ? (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Looking for devices on the same Wi-Fi...
            </span>
          ) : (
            connectedDevices.map((dev) => (
              <div key={dev.id} className={`peer-chip ${dev.isSelf ? 'self' : ''}`}>
                {dev.type === 'mobile' ? <Smartphone size={14} /> : <Laptop size={14} />}
                <span>{dev.name} {dev.isSelf ? '(You)' : ''}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Grid: Composer & Stream */}
      <main className="main-grid">
        {/* Left: Composer Box */}
        <section className="composer-card glass-panel">
          <div className="composer-tabs">
            <button
              className={`composer-tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setActiveTab('files');
              }}
            >
              <UploadCloud size={16} />
              <span>Files</span>
            </button>
            <button
              className={`composer-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setActiveTab('text');
              }}
            >
              <FileText size={16} />
              <span>Text</span>
            </button>
            <button
              className={`composer-tab ${activeTab === 'link' ? 'active' : ''}`}
              onClick={() => {
                playTapSound(isMuted);
                setActiveTab('link');
              }}
            >
              <LinkIcon size={16} />
              <span>Link</span>
            </button>
          </div>

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                className={`dropzone ${isDragOver ? 'drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon-wrap">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <div className="dropzone-title">Drop files here to share</div>
                  <div className="dropzone-sub">Photos, videos, documents, or archives</div>
                </div>
              </div>

              {/* Mobile Quick Action Buttons */}
              <div className="mobile-action-row">
                <button
                  className="mobile-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <File size={16} />
                  <span>Choose Files</span>
                </button>
                {isMobile && (
                  <button
                    className="mobile-upload-btn"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera size={16} />
                    <span>Camera</span>
                  </button>
                )}
              </div>

              {isUploading && (
                <div className="progress-card">
                  <div className="progress-header">
                    <span>Transferring to nearby devices...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Tab */}
          {activeTab === 'text' && (
            <form onSubmit={handleSendText} className="text-composer-form">
              <textarea
                className="gentle-textarea"
                placeholder="Type or paste any text, clipboard snippets, or notes here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <button
                type="submit"
                className="primary-send-btn"
                disabled={!textContent.trim()}
              >
                <Send size={16} />
                <span>Send to All Devices</span>
              </button>
            </form>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <form onSubmit={handleSendLink} className="text-composer-form">
              <input
                type="text"
                className="gentle-input"
                placeholder="https://example.com/article"
                value={linkContent}
                onChange={(e) => setLinkContent(e.target.value)}
              />
              <button
                type="submit"
                className="primary-send-btn"
                disabled={!linkContent.trim()}
              >
                <LinkIcon size={16} />
                <span>Send Link Instantly</span>
              </button>
            </form>
          )}
        </section>

        {/* Right: Activity Stream / Feed */}
        <section className="feed-section">
          <div className="feed-header">
            <div className="feed-title-wrap">
              <h2 className="feed-title">Shared Feed</h2>
              <span className="feed-count-badge">{filteredItems.length}</span>
            </div>

            <div className="feed-actions">
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'file', 'text', 'link'].map(filter => (
                  <button
                    key={filter}
                    className={`feed-filter-btn ${feedFilter === filter ? 'active' : ''}`}
                    onClick={() => {
                      playTapSound(isMuted);
                      setFeedFilter(filter);
                    }}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

              {items.length > 0 && (
                <button className="clear-btn" onClick={handleClearAll} title="Clear all history">
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="empty-state glass-panel">
              <div className="empty-icon-wrap">
                <Layers size={28} />
              </div>
              <h3 className="empty-title">Nothing shared yet</h3>
              <p className="empty-sub">
                Drop files, paste notes, or scan the QR code from your phone to start transferring instantly.
              </p>
            </div>
          ) : (
            <div className="feed-cards-list">
              {filteredItems.map(item => (
                <div key={item.id} className="item-card glass-panel">
                  {/* Card Header */}
                  <div className="item-card-header">
                    <div className="item-origin">
                      <span className={`origin-badge ${item.senderType}`}>
                        {item.senderType === 'mobile' ? 'Mobile' : 'Laptop'}
                      </span>
                      <span>from {item.senderName}</span>
                    </div>

                    <div className="item-meta">
                      <span className="item-time">{formatTime(item.timestamp)}</span>
                      <button
                        className="item-delete-btn"
                        title="Remove"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Text */}
                  {item.type === 'text' && (
                    <div className="text-content-box">
                      {item.content}
                    </div>
                  )}

                  {/* Card Body: Link */}
                  {item.type === 'link' && (
                    <div className="link-content-box">
                      <div className="link-title-wrap">
                        <div className="link-icon-wrap">
                          <LinkIcon size={18} />
                        </div>
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-url-text"
                        >
                          {item.content}
                        </a>
                      </div>
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-pill-btn"
                      >
                        <ExternalLink size={13} />
                        <span>Open</span>
                      </a>
                    </div>
                  )}

                  {/* Card Body: File */}
                  {item.type === 'file' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Image Preview if applicable */}
                      {item.fileType === 'image' && (
                        <div
                          className="image-preview-wrap"
                          onClick={() => setPreviewImage(item.viewUrl)}
                          title="Click to view full size"
                        >
                          <img
                            src={item.viewUrl}
                            alt={item.originalName}
                            className="image-preview-thumb"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="file-content-box">
                        <div className="file-info-left">
                          <div className="file-icon-wrap">
                            {item.fileType === 'image' ? (
                              <ImageIcon size={22} />
                            ) : item.fileType === 'video' ? (
                              <Film size={22} />
                            ) : item.fileType === 'audio' ? (
                              <Music size={22} />
                            ) : (
                              <File size={22} />
                            )}
                          </div>
                          <div className="file-details">
                            <span className="file-name" title={item.originalName}>
                              {item.originalName}
                            </span>
                            <span className="file-size">{formatSize(item.size)}</span>
                          </div>
                        </div>

                        <a
                          href={item.downloadUrl}
                          className="action-pill-btn primary"
                          download={item.originalName}
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Card Footer: Copy / Quick Actions */}
                  <div className="item-card-footer">
                    {item.type === 'text' && (
                      <button
                        className="action-pill-btn"
                        onClick={() => handleCopy(item.content, item.id)}
                      >
                        {copiedId === item.id ? <Check size={14} color="var(--emerald)" /> : <Copy size={14} />}
                        <span>{copiedId === item.id ? 'Copied!' : 'Copy Text'}</span>
                      </button>
                    )}

                    {item.type === 'link' && (
                      <button
                        className="action-pill-btn"
                        onClick={() => handleCopy(item.content, item.id)}
                      >
                        {copiedId === item.id ? <Check size={14} color="var(--emerald)" /> : <Copy size={14} />}
                        <span>{copiedId === item.id ? 'Copied Link' : 'Copy Link'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* QR Code Modal Dialog */}
      {showQrModal && networkInfo && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowQrModal(false)}
            >
              <X size={18} />
            </button>

            <div className="brand-logo-wrap" style={{ margin: '0 auto' }}>
              <QrCode size={24} />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Connect Your Phone</h3>
              <p className="qr-instructions" style={{ marginTop: '6px' }}>
                Scan this with your mobile camera while connected to the same Wi-Fi.
              </p>
            </div>

            <div className="qr-frame">
              <img src={networkInfo.qrDataUrl} alt="Connect QR Code" />
            </div>

            <div className="connect-url-bar" style={{ margin: '0 auto' }}>
              <span>{networkInfo.connectUrl}</span>
            </div>

            <button
              className="action-pill-btn primary"
              style={{ padding: '10px 20px', width: '100%', justifyContent: 'center' }}
              onClick={() => handleCopy(networkInfo.connectUrl, 'qr_url')}
            >
              {copiedId === 'qr_url' ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedId === 'qr_url' ? 'URL Copied!' : 'Copy Direct URL'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullsize Image Lightbox */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <button
              className="modal-close-btn"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#FFF', top: -14, right: -14 }}
              onClick={() => setPreviewImage(null)}
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '16px', display: 'block', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <Sparkles size={16} color="#818CF8" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

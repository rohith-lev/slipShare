'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import PeersBar from './components/PeersBar';
import Composer from './components/Composer';
import ActivityFeed from './components/ActivityFeed';
import QrModal from './components/QrModal';
import PreviewModal from './components/PreviewModal';
import { playBlipSound, playOutSound, playFailSound } from './utils/sound';

export default function SlipShareApp() {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('files');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // User Preferences
  const [theme, setTheme] = useState('light');
  const [isMuted, setIsMuted] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Device Info & connection status
  const [deviceName, setDeviceName] = useState('My Device');
  const [deviceType, setDeviceType] = useState('desktop');
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'

  // Refs
  const esRef = useRef(null);               // EventSource instance
  const clientIdRef = useRef(null);         // SSE-assigned client ID (for /api/devices calls)
  const toastTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isMutedRef = useRef(isMuted);       // stable ref to avoid stale closures in SSE handler
  const connectSSERef = useRef(null);       // forward-ref so reconnect can call itself

  // ─── Initialise theme, device type & name once on mount ───────────────────
  useEffect(() => {
    isMountedRef.current = true;

    const savedTheme = localStorage.getItem('slip_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedMuted = localStorage.getItem('slip_muted') === 'true';
    setIsMuted(savedMuted);
    isMutedRef.current = savedMuted;

    // Client-side device detection (UA + touch)
    const ua = navigator.userAgent;
    const isMobileUA =
      /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) ||
      (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    setDeviceType(isMobileUA ? 'mobile' : 'desktop');

    // Auto-assign a readable device name the first time
    const saved = localStorage.getItem('slip_device_name');
    if (saved) {
      setDeviceName(saved);
    } else {
      let name = isMobileUA ? 'Mobile Phone' : 'Laptop';
      if (/iphone/i.test(ua)) name = 'iPhone';
      else if (/ipad/i.test(ua)) name = 'iPad';
      else if (/android/i.test(ua)) name = 'Android Phone';
      else if (/macintosh/i.test(ua)) name = 'MacBook';
      else if (/windows/i.test(ua)) name = 'Windows PC';
      else if (/linux/i.test(ua)) name = 'Linux Laptop';
      setDeviceName(name);
    }

    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Sync preferences ────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('slip_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('slip_muted', String(isMuted));
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const triggerToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  // ─── Network info (QR code URL) ───────────────────────────────────────────
  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/info', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) setNetworkInfo(await res.json());
    } catch (e) {
      console.warn('Network info fetch failed:', e);
    }
  };

  // ─── SSE connection ───────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Don't open a second connection if one is already live
    if (esRef.current && esRef.current.readyState === EventSource.OPEN) return;

    // Close any stale connection first
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setWsStatus('connecting');

    const es = new EventSource('/api/events');
    esRef.current = es;

    es.onopen = () => {
      if (!isMountedRef.current) return;
      setWsStatus('connected');
    };

    es.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'welcome') {
          // Store our server-assigned ID for subsequent /api/devices calls
          clientIdRef.current = data.clientId;
          if (data.items) setItems(data.items);

          // Send stored device name to the server right away
          const customName = localStorage.getItem('slip_device_name');
          if (customName && data.clientId) {
            fetch('/api/devices', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
              },
              body: JSON.stringify({ type: 'set_name', clientId: data.clientId, name: customName }),
            }).catch(() => {});
          }

          if (data.clientType) setDeviceType(data.clientType);
          if (!localStorage.getItem('slip_device_name') && data.clientName) {
            setDeviceName(data.clientName);
          }

        } else if (data.type === 'devices_updated') {
          const devices = data.devices || [];
          setConnectedDevices(devices);
          const self = devices.find((d) => d.isSelf);
          if (self) setDeviceType(self.type);

        } else if (data.type === 'item_received') {
          setItems((prev) => {
            if (prev.some((i) => i.id === data.item.id)) return prev;
            return [data.item, ...prev];
          });
          playBlipSound(isMutedRef.current);
          triggerToast(`New ${data.item.type} from ${data.item.senderName}`);

        } else if (data.type === 'item_deleted') {
          setItems((prev) => prev.filter((i) => i.id !== data.itemId));

        } else if (data.type === 'history_cleared') {
          setItems([]);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      if (!isMountedRef.current) return;
      setWsStatus('disconnected');
      es.close();
      esRef.current = null;
      // Auto-reconnect after 2.5 s
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (connectSSERef.current) connectSSERef.current();
      }, 2500);
    };
  }, []); // stable — no reactive deps needed

  // Keep the ref in sync
  useEffect(() => { connectSSERef.current = connectSSE; }, [connectSSE]);

  // ─── Mount: connect SSE + fetch network info ───────────────────────────────
  useEffect(() => {
    fetchNetworkInfo();
    connectSSE();

    // Re-connect when phone screen unlocks / tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!esRef.current || esRef.current.readyState !== EventSource.OPEN) {
          connectSSE();
        }
        fetchNetworkInfo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, [connectSSE]);

  // ─── Rename this device ───────────────────────────────────────────────────
  const handleDeviceNameChange = (newName) => {
    setDeviceName(newName);
    localStorage.setItem('slip_device_name', newName);
    // Notify server via REST (SSE is server→client only)
    if (clientIdRef.current) {
      fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ type: 'set_name', clientId: clientIdRef.current, name: newName }),
      }).catch(() => {});
    }
  };

  // ─── File upload ──────────────────────────────────────────────────────────
  const handleUploadFiles = (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    formData.append('senderName', deviceName);
    formData.append('senderType', deviceType);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        playOutSound(isMutedRef.current);
        triggerToast(`${files.length} file${files.length > 1 ? 's' : ''} sent`);
      } else {
        playFailSound(isMutedRef.current);
        let msg = 'Upload failed — please retry';
        try { const r = JSON.parse(xhr.responseText); if (r?.error) msg = r.error; } catch { /* ignore */ }
        if (xhr.status === 413) msg = 'File too large for this server tier';
        triggerToast(msg);
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      playFailSound(isMutedRef.current);
      triggerToast('Upload failed: network error');
    };

    xhr.send(formData);
  };

  // ─── Text note ────────────────────────────────────────────────────────────
  const handleSendText = async (content) => {
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ type: 'text', content, senderName: deviceName, senderType: deviceType }),
      });
    } catch {
      playFailSound(isMutedRef.current);
      triggerToast('Failed to send text');
    }
  };

  // ─── Link ─────────────────────────────────────────────────────────────────
  const handleSendLink = async (url) => {
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ type: 'link', content: url, title: url, senderName: deviceName, senderType: deviceType }),
      });
    } catch {
      playFailSound(isMutedRef.current);
      triggerToast('Failed to broadcast link');
    }
  };

  // ─── Delete item ──────────────────────────────────────────────────────────
  const handleDeleteItem = async (id) => {
    try {
      await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
    } catch {
      triggerToast('Failed to delete item');
    }
  };

  // ─── Clear all ────────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    try {
      await fetch('/api/items', {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
    } catch {
      triggerToast('Failed to clear history');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <Header
        theme={theme}
        setTheme={setTheme}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        onOpenQr={() => setShowQrModal(true)}
      />

      <PeersBar
        networkInfo={networkInfo}
        connectedDevices={connectedDevices}
        deviceName={deviceName}
        setDeviceName={setDeviceName}
        deviceType={deviceType}
        wsStatus={wsStatus}
        onNameChange={handleDeviceNameChange}
        isMuted={isMuted}
        onOpenQr={() => setShowQrModal(true)}
        onReconnect={connectSSE}
      />

      <Composer
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onUploadFiles={handleUploadFiles}
        onSendText={handleSendText}
        onSendLink={handleSendLink}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        isMuted={isMuted}
        triggerToast={triggerToast}
      />

      <ActivityFeed
        items={items}
        onDeleteItem={handleDeleteItem}
        onClearAll={handleClearAll}
        onPreviewImage={setPreviewImage}
        isMuted={isMuted}
        triggerToast={triggerToast}
      />

      <QrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        networkInfo={networkInfo}
        isMuted={isMuted}
        triggerToast={triggerToast}
      />

      <PreviewModal
        previewUrl={previewImage}
        onClose={() => setPreviewImage(null)}
        isMuted={isMuted}
      />

      {toastMessage && <div className="toast-notice">{toastMessage}</div>}
    </div>
  );
}

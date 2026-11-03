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

  // Device Info & WS Status
  const [deviceName, setDeviceName] = useState('My Device');
  const [deviceType, setDeviceType] = useState('desktop');
  const [wsStatus, setWsStatus] = useState('connecting');

  const wsRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  // Ref for isMuted so WS onmessage closure always has current value
  const isMutedRef = useRef(isMuted);

  // Initialize theme and device detection on client mount
  useEffect(() => {
    isMountedRef.current = true;

    const savedTheme = localStorage.getItem('slip_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedMuted = localStorage.getItem('slip_muted') === 'true';
    setIsMuted(savedMuted);

    // Precise client-side device type detection
    const isMobileDevice = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    
    setDeviceType(isMobileDevice ? 'mobile' : 'desktop');

    const savedDevice = localStorage.getItem('slip_device_name');
    if (savedDevice) {
      setDeviceName(savedDevice);
    } else {
      if (/iphone/i.test(navigator.userAgent)) setDeviceName('iPhone');
      else if (/ipad/i.test(navigator.userAgent)) setDeviceName('iPad');
      else if (/android/i.test(navigator.userAgent)) setDeviceName('Android Phone');
      else if (/macintosh/i.test(navigator.userAgent)) setDeviceName('MacBook');
      else if (/windows/i.test(navigator.userAgent)) setDeviceName('Windows PC');
      else if (/linux/i.test(navigator.userAgent)) setDeviceName('Linux Laptop');
      else setDeviceName(isMobileDevice ? 'Mobile Phone' : 'Laptop');
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('slip_theme', theme);
  }, [theme]);

  // Sync sound settings
  useEffect(() => {
    localStorage.setItem('slip_muted', String(isMuted));
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Trigger toast notifications
  const triggerToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  // Fetch Network & QR information
  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/info', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (e) {
      console.warn('Network info error:', e);
    }
  };

  // Fetch initial items
  const fetchItems = async () => {
    try {
      const res = await fetch('/api/items', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setItems(data.items);
        }
      }
    } catch (e) {
      console.warn('Items fetch error:', e);
    }
  };

  const connectWebSocketRef = useRef(null);

  // Setup WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setWsStatus('connected');
        const customName = localStorage.getItem('slip_device_name');
        if (customName) {
          ws.send(JSON.stringify({ type: 'set_name', name: customName }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'welcome') {
            if (data.items) setItems(data.items);
            if (!localStorage.getItem('slip_device_name') && data.clientName) {
              setDeviceName(data.clientName);
            }
            if (data.clientType) {
              setDeviceType(data.clientType);
            }
          } else if (data.type === 'devices_updated') {
            const devices = data.devices || [];
            setConnectedDevices(devices);
            const selfDev = devices.find((d) => d.isSelf);
            if (selfDev) {
              setDeviceType(selfDev.type);
            }
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
          } else if (data.type === 'server_ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'client_pong' }));
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsStatus('disconnected');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectWebSocketRef.current) connectWebSocketRef.current();
        }, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.warn('WS creation error:', e);
      setWsStatus('disconnected');
    }
  }, [isMuted]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    fetchNetworkInfo();
    fetchItems();
    connectWebSocket();

    // Reconnect on tab visibility change (e.g. phone screen unlock)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }
        fetchNetworkInfo();
        fetchItems();
      }
    };

    // Client-side ping to prevent Wi-Fi router / carrier TCP timeouts
    const pingTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore
        }
      }
    }, 15000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pingTimer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Rename current device
  const handleDeviceNameChange = (newName) => {
    setDeviceName(newName);
    localStorage.setItem('slip_device_name', newName);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_name', name: newName }));
    }
  };

  // Upload Files (Supports multi-file and large transfers)
  const handleUploadFiles = (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    formData.append('senderName', deviceName);
    formData.append('senderType', deviceType);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        playOutSound(isMuted);
        triggerToast(`${files.length} file${files.length > 1 ? 's' : ''} sent successfully`);
      } else {
        playFailSound(isMuted);
        let errorMsg = 'Upload failed, please retry';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res?.error) errorMsg = res.error;
        } catch {}
        if (xhr.status === 413) {
          errorMsg = 'File too large for this network or tunnel';
        }
        console.error('Upload failed with status', xhr.status, xhr.responseText);
        triggerToast(errorMsg);
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      playFailSound(isMuted);
      console.error('Upload failed with network error');
      triggerToast('Upload failed: network connection error');
    };

    xhr.send(formData);
  };

  // Send Text Note
  const handleSendText = async (content) => {
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          type: 'text',
          content,
          senderName: deviceName,
          senderType: deviceType,
        }),
      });
    } catch {
      playFailSound(isMuted);
      triggerToast('Failed to send text');
    }
  };

  // Send Link
  const handleSendLink = async (url) => {
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          type: 'link',
          content: url,
          title: url,
          senderName: deviceName,
          senderType: deviceType,
        }),
      });
    } catch {
      playFailSound(isMuted);
      triggerToast('Failed to broadcast link');
    }
  };

  // Delete Single Item
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

  // Clear All Items
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

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        theme={theme}
        setTheme={setTheme}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        onOpenQr={() => setShowQrModal(true)}
      />

      {/* Connected Peers Strip with accurate live Wi-Fi detection */}
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
        onReconnect={connectWebSocket}
      />

      {/* Drag & Drop / Instant Sharing Area */}
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

      {/* Live Activity Feed */}
      <ActivityFeed
        items={items}
        onDeleteItem={handleDeleteItem}
        onClearAll={handleClearAll}
        onPreviewImage={setPreviewImage}
        isMuted={isMuted}
        triggerToast={triggerToast}
      />

      {/* QR Code Modal for Pairing */}
      <QrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        networkInfo={networkInfo}
        isMuted={isMuted}
        triggerToast={triggerToast}
      />

      {/* Image Preview Lightbox */}
      <PreviewModal
        previewUrl={previewImage}
        onClose={() => setPreviewImage(null)}
        isMuted={isMuted}
      />

      {/* Toast Notification */}
      {toastMessage && <div className="toast-notice">{toastMessage}</div>}
    </div>
  );
}

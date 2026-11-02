'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import PeersBar from './components/PeersBar';
import Composer from './components/Composer';
import ActivityFeed from './components/ActivityFeed';
import QrModal from './components/QrModal';
import PreviewModal from './components/PreviewModal';
import { playBlipSound, playTapSound } from './utils/sound';

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

  // Device Info
  const [deviceName, setDeviceName] = useState('My Device');

  const wsRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Initialize theme and device name on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('slip_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedMuted = localStorage.getItem('slip_muted') === 'true';
    setIsMuted(savedMuted);

    const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(navigator.userAgent);
    const savedDevice = localStorage.getItem('slip_device_name') || (isMobile ? 'Mobile Phone' : 'Laptop');
    setDeviceName(savedDevice);
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('slip_theme', theme);
  }, [theme]);

  // Sync sound settings
  useEffect(() => {
    localStorage.setItem('slip_muted', String(isMuted));
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
      const res = await fetch('/api/info');
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
      const res = await fetch('/api/items');
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

  // Setup WebSocket connection
  useEffect(() => {
    fetchNetworkInfo();
    fetchItems();

    let isMounted = true;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const currentName = localStorage.getItem('slip_device_name') || deviceName;
        ws.send(JSON.stringify({ type: 'set_name', name: currentName }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'welcome') {
            if (data.items) setItems(data.items);
          } else if (data.type === 'devices_updated') {
            setConnectedDevices(data.devices || []);
          } else if (data.type === 'item_received') {
            setItems((prev) => {
              if (prev.some((i) => i.id === data.item.id)) return prev;
              return [data.item, ...prev];
            });
            playBlipSound(isMuted);
            triggerToast(`New ${data.item.type} from ${data.item.senderName}`);
          } else if (data.type === 'item_deleted') {
            setItems((prev) => prev.filter((i) => i.id !== data.itemId));
          } else if (data.type === 'history_cleared') {
            setItems([]);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isMuted]);

  // Handle device nickname update
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

    const isMobile = /mobile|iphone|ipod|android/i.test(navigator.userAgent);
    formData.append('senderName', deviceName);
    formData.append('senderType', isMobile ? 'mobile' : 'desktop');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

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
        playBlipSound(isMuted);
        triggerToast(`${files.length} file${files.length > 1 ? 's' : ''} sent successfully`);
      } else {
        triggerToast('Upload failed, please retry');
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      triggerToast('Upload failed, network error');
    };

    xhr.send(formData);
  };

  // Send Text Note
  const handleSendText = async (content) => {
    const isMobile = /mobile|iphone|ipod|android/i.test(navigator.userAgent);
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content,
          senderName: deviceName,
          senderType: isMobile ? 'mobile' : 'desktop',
        }),
      });
    } catch (e) {
      triggerToast('Failed to send text');
    }
  };

  // Send Link
  const handleSendLink = async (url) => {
    const isMobile = /mobile|iphone|ipod|android/i.test(navigator.userAgent);
    try {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'link',
          content: url,
          title: url,
          senderName: deviceName,
          senderType: isMobile ? 'mobile' : 'desktop',
        }),
      });
    } catch (e) {
      triggerToast('Failed to broadcast link');
    }
  };

  // Delete Single Item
  const handleDeleteItem = async (id) => {
    try {
      await fetch(`/api/items/${id}`, { method: 'DELETE' });
    } catch (e) {
      triggerToast('Failed to delete item');
    }
  };

  // Clear All Items
  const handleClearAll = async () => {
    try {
      await fetch('/api/items', { method: 'DELETE' });
    } catch (e) {
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
        connectedCount={connectedDevices.length}
      />

      {/* Connected Peers Strip */}
      <PeersBar
        networkInfo={networkInfo}
        connectedDevices={connectedDevices}
        deviceName={deviceName}
        setDeviceName={setDeviceName}
        onNameChange={handleDeviceNameChange}
        isMuted={isMuted}
        onOpenQr={() => setShowQrModal(true)}
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

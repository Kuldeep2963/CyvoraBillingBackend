import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { fetchNotifications, getGlobalSettings } from '../utils/api';

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pollSeconds, setPollSeconds] = useState(10);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchNotifications({ limit: 10 });
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (e) {
      console.error('Notifications load failed', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await getGlobalSettings();
        if (!mounted) return;
        setPollSeconds(Number(settings.notificationPollingSeconds) || 10);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // initial load
    load();
    const interval = setInterval(() => load(true), Math.max(5, Math.min(3600, Number(pollSeconds || 10))) * 1000);

    const onRefresh = () => { refresh(); };
    const onSettings = (e) => {
      const next = Number(e?.detail?.notificationPollingSeconds) || pollSeconds;
      setPollSeconds(next);
    };

    window.addEventListener('notifications-refresh-requested', onRefresh);
    window.addEventListener('settings-updated', onSettings);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-refresh-requested', onRefresh);
      window.removeEventListener('settings-updated', onSettings);
    };
  }, [load, refresh, pollSeconds]);

  const value = useMemo(() => ({ notifications, unreadCount, loading, refresh }), [notifications, unreadCount, loading, refresh]);
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

export default NotificationsContext;

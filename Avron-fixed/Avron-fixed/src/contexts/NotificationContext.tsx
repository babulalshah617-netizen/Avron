import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Notification } from '../types';

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  toasts: ToastMessage[];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addToast: (msg: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data);
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        const notif = payload.new as Notification;
        setNotifications(prev => [notif, ...prev]);
        addToast({
          title: notif.title,
          message: notif.message,
          type: notif.type === 'critical' ? 'error' : notif.type as ToastMessage['type'],
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { ...msg, id }]);
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, toasts,
      markAsRead, markAllAsRead, addToast, removeToast,
      refreshNotifications: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

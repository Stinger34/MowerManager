import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Notification } from '@shared/schema';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const queryClient = useQueryClient();
  
  // Fetch notifications
  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifications');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await apiRequest('PATCH', `/api/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiRequest('PATCH', '/api/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiRequest('DELETE', `/api/notifications/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const refreshNotifications = () => {
    refetch();
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
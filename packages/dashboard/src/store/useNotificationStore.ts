import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  // For linking to specific resources
  resourceType?: 'agent' | 'trace' | 'alert' | 'cost';
  resourceId?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

/**
 * Notification Store
 * 
 * Manages in-app notifications including:
 * - Adding new notifications (from WebSocket events, etc.)
 * - Tracking read/unread status
 * - Maintaining unread count for badge
 * 
 * Note: Notifications are not persisted - they reset on page refresh
 * For persistent notifications, they should come from the backend
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
      unreadCount: state.unreadCount + 1,
    }));
  },
  
  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === id);
      if (!notification || notification.read) return state;
      
      return {
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },
  
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
  
  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === id);
      return {
        notifications: state.notifications.filter(n => n.id !== id),
        unreadCount: notification && !notification.read 
          ? Math.max(0, state.unreadCount - 1) 
          : state.unreadCount,
      };
    });
  },
  
  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));

// Helper function to create notifications from WebSocket events
export function createNotificationFromEvent(event: {
  type: string;
  data: any;
}): Omit<Notification, 'id' | 'timestamp' | 'read'> | null {
  switch (event.type) {
    case 'alert:triggered':
      return {
        type: 'warning',
        title: 'Alert Triggered',
        message: event.data.message || 'An alert threshold was exceeded',
        resourceType: 'alert',
        resourceId: event.data.alertId,
      };
    
    case 'agent:error':
      return {
        type: 'error',
        title: 'Agent Error',
        message: `Agent "${event.data.agentName}" encountered an error`,
        resourceType: 'agent',
        resourceId: event.data.agentId,
      };
    
    case 'cost:threshold':
      return {
        type: 'warning',
        title: 'Cost Threshold Warning',
        message: `You've used ${event.data.percentUsed}% of your budget`,
        resourceType: 'cost',
      };
    
    default:
      return null;
  }
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModalState {
  id: string;
  data?: unknown;
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Modal
  activeModal: ModalState | null;
  openModal: (id: string, data?: unknown) => void;
  closeModal: () => void;
  
  // Theme (managed by next-themes, but we track preference here too)
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Notifications panel
  notificationsPanelOpen: boolean;
  toggleNotificationsPanel: () => void;
  setNotificationsPanelOpen: (open: boolean) => void;
  
  // Command palette
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

/**
 * UI Store
 * 
 * Manages global UI state including:
 * - Sidebar collapsed state (persisted)
 * - Modal management
 * - Theme preference
 * - Notifications panel
 * - Command palette
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      // Modal
      activeModal: null,
      openModal: (id, data) => set({ activeModal: { id, data } }),
      closeModal: () => set({ activeModal: null }),
      
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Notifications
      notificationsPanelOpen: false,
      toggleNotificationsPanel: () => set((state) => ({ 
        notificationsPanelOpen: !state.notificationsPanelOpen 
      })),
      setNotificationsPanelOpen: (open) => set({ notificationsPanelOpen: open }),
      
      // Command palette
      commandPaletteOpen: false,
      toggleCommandPalette: () => set((state) => ({ 
        commandPaletteOpen: !state.commandPaletteOpen 
      })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'aethermind-ui-storage',
      // Only persist certain values
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

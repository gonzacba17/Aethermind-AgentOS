import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWebSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return wsUrl;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (!apiUrl) {
    return `ws://${window.location.hostname}:3001/ws`;
  }
  
  const url = apiUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  return `${url}/ws`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

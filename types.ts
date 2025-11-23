import React from 'react';

export interface StoryOption {
  label: string;
  action: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'tool' | 'intel';
  effectValue?: number; // e.g. +Health amount
  quantity: number;
}

export interface PlayerStats {
  health: number;
  wealth: number;
  xp: number;
}

export interface StorySegment {
  id: string;
  narrative: string;
  visualPrompts: string[];
  options: StoryOption[];
  statUpdates?: Partial<PlayerStats>;
  loot?: Item[]; // Items found in this segment
}

export type LogType = 'system' | 'narrative' | 'command' | 'info' | 'error' | 'success';

export interface LogEntry {
  id: string;
  type: LogType;
  content: string;
  options?: StoryOption[]; // Store options data instead of ReactNode for persistence
  timestamp: string;
  isRestored?: boolean; // Flag to skip animation on reloaded logs
}

export interface GameState {
  history: StorySegment[];
  currentSegment: StorySegment | null;
  isLoading: boolean;
  isAudioPlaying: boolean;
  imageUrls: string[];
  playerStats: PlayerStats;
  inventory: Item[];
}

export enum LoadingStage {
  IDLE = 'IDLE',
  WRITING = 'WRITING',
  PAINTING = 'PAINTING',
  VOICING = 'VOICING'
}
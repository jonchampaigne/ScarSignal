export interface StoryOption {
  label: string;
  action: string;
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
}

export interface GameState {
  history: StorySegment[];
  currentSegment: StorySegment | null;
  isLoading: boolean;
  isAudioPlaying: boolean;
  imageUrls: string[];
  playerStats: PlayerStats;
}

export enum LoadingStage {
  IDLE = 'IDLE',
  WRITING = 'WRITING',
  PAINTING = 'PAINTING',
  VOICING = 'VOICING'
}
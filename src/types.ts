export interface Channel {
  id: number;
  key: string;
  name: string;
  description: string;
  asset_url: string;
  banner_url: string;
  images?: {
    default?: string;
    square?: string;
    compact?: string;
  };
}

export interface TrackInfo {
  artist: string;
  title: string;
  release: string;
  art_url: string;
  started: number;
  duration: number;
  elapsed: number;
  remaining: number;
  progressPercent: number;
  track_id: number;
}

export type LayoutPreset = 'classic' | 'compact' | 'sidebar' | 'retro' | 'marquee';

export type FontStyle = 'sans' | 'display' | 'mono' | 'serif';

export interface OverlayConfig {
  layout: LayoutPreset;
  font: FontStyle;
  bgColor: string;
  bgOpacity: number;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  showProgress: boolean;
  animateOnChange: boolean;
  progressColor: string;
  customCss: string;
}

export const DEFAULT_CONFIG: OverlayConfig = {
  layout: 'classic',
  font: 'sans',
  bgColor: '#09090b', // zinc-950
  bgOpacity: 85,
  textColor: '#f4f4f5', // zinc-100
  accentColor: '#10b981', // emerald-500
  borderRadius: 12,
  showProgress: true,
  animateOnChange: true,
  progressColor: '#10b981',
  customCss: '',
};

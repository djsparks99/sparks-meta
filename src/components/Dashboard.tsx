import { useState, useEffect, useRef } from "react";
import { 
  Music, Settings, Layers, Volume2, VolumeX, Play, Pause, Copy, Check, 
  ExternalLink, Search, Sliders, Palette, Radio, Eye, Info, CheckCircle, Flame, Disc
} from "lucide-react";
import { Channel, TrackInfo, OverlayConfig, DEFAULT_CONFIG, LayoutPreset, FontStyle } from "../types";
import OverlayRenderer from "./OverlayRenderer";

export default function Dashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [streamUrl, setStreamUrl] = useState("http://prem1.di.fm:80/dubstep?1527ecfa0ad5bc0827ca02e7");
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [config, setConfig] = useState<OverlayConfig>(DEFAULT_CONFIG);
  
  // Player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'settings' | 'channels'>('settings');

  // Fetch channels list on mount
  useEffect(() => {
    fetch("/api/channels")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setChannels(data);
          setFilteredChannels(data);
          
          // Set initial channel based on our streamUrl
          const initialKey = "dubstep";
          const chan = data.find(c => c.key === initialKey);
          if (chan) {
            setActiveChannel(chan);
          }
        }
      })
      .catch((err) => console.error("Error loading channels:", err));
  }, []);

  // Filter channels list
  useEffect(() => {
    if (!searchQuery) {
      setFilteredChannels(channels);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredChannels(
        channels.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.key.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, channels]);

  // Fetch track metadata for the active channel periodically
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const fetchNowPlaying = async () => {
      if (!activeChannel) return;
      try {
        const response = await fetch(`/api/now-playing?key=${activeChannel.key}`);
        if (!response.ok) throw new Error("Metadata request failed");
        const data = await response.json();
        if (data && data.track) {
          setCurrentTrack(data.track);
        }
      } catch (err) {
        console.error("Error fetching now playing:", err);
      }
    };

    fetchNowPlaying();
    timer = setInterval(fetchNowPlaying, 5000); // Fetch metadata every 5 seconds

    return () => clearInterval(timer);
  }, [activeChannel]);

  // Handle channel selection
  const selectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    // Construct a premium or public stream-like URL path for standard play
    const mockUrl = `http://prem1.di.fm:80/${channel.key}?1527ecfa0ad5bc0827ca02e7`;
    setStreamUrl(mockUrl);
    setTab('settings');

    // If audio is playing, update stream source and play
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.src = mockUrl;
      audioRef.current.play().catch(e => {
        console.error("Audio playback interrupted on change:", e);
        setPlayerError("Stream link expired or requires premium key. Metadata overlay remains fully active!");
        setIsPlayingAudio(false);
      });
    }
  };

  // Manual URL submission
  const handleUrlSubmit = (url: string) => {
    setStreamUrl(url);
    // Parse key to match channel list
    let parsedKey = "";
    try {
      let pathname = url.trim();
      if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
        const parsed = new URL(pathname);
        pathname = parsed.pathname;
      }
      const segment = pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/")[0];
      parsedKey = segment.split(".")[0].split("?")[0].toLowerCase();
    } catch (e) {
      parsedKey = url.trim().toLowerCase();
    }

    const chan = channels.find(c => c.key === parsedKey || c.name.toLowerCase() === parsedKey);
    if (chan) {
      setActiveChannel(chan);
    } else {
      // Create transient channel representation if not found in catalog
      setActiveChannel({
        id: 0,
        key: parsedKey || "custom",
        name: parsedKey ? (parsedKey.charAt(0).toUpperCase() + parsedKey.slice(1)) : "Custom Stream",
        description: "Custom user entered stream link",
        asset_url: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=100&h=100&fit=crop",
        banner_url: "",
      });
    }
  };

  // Audio Playback toggles
  const toggleAudio = () => {
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingAudio(false);
      setPlayerError(null);
    } else {
      setPlayerError(null);
      if (!audioRef.current) {
        audioRef.current = new Audio(streamUrl);
      } else {
        audioRef.current.src = streamUrl;
      }
      audioRef.current.volume = isMuted ? 0 : volume;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        setIsPlayingAudio(true);
        playPromise.catch((error) => {
          console.error("Audio playback error:", error);
          setPlayerError("Streaming failed. This stream may require custom authorization keys. Metadata will still sync correctly!");
          setIsPlayingAudio(false);
        });
      }
    }
  };

  // Volume control adjustments
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume;
    }
  };

  // Cleanup player on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Generate dynamic OBS overlay URL
  const generateOverlayUrl = () => {
    const origin = window.location.origin;
    const params = new URLSearchParams();
    
    if (streamUrl) params.append("url", streamUrl);
    else if (activeChannel) params.append("key", activeChannel.key);

    params.append("layout", config.layout);
    params.append("font", config.font);
    params.append("bgColor", config.bgColor);
    params.append("bgOpacity", String(config.bgOpacity));
    params.append("textColor", config.textColor);
    params.append("accentColor", config.accentColor);
    params.append("borderRadius", String(config.borderRadius));
    params.append("showProgress", String(config.showProgress));
    params.append("animateOnChange", String(config.animateOnChange));
    params.append("progressColor", config.progressColor);
    
    if (config.customCss) {
      params.append("customCss", config.customCss);
    }

    return `${origin}/overlay?${params.toString()}`;
  };

  const copyUrlToClipboard = () => {
    const url = generateOverlayUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const updateConfigValue = (key: keyof OverlayConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans" id="dashboard-root">
      {/* HEADER SECTION */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-md" id="dashboard-header">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-1.5">
              OBS Live Metadata <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-normal">DI.FM Edition</span>
            </h1>
            <p className="text-xs text-zinc-400">Export high-fidelity current song tags and dynamic sleeve art directly into OBS Studio</p>
          </div>
        </div>

        {/* Dynamic Mini Player inside Header */}
        <div className="flex items-center space-x-3 bg-zinc-950/80 border border-zinc-800 rounded-lg p-2 max-w-sm sm:w-80">
          <button 
            onClick={toggleAudio}
            className={`p-2.5 rounded-md text-white transition-all flex-shrink-0 ${
              isPlayingAudio 
                ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/10' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/10'
            }`}
          >
            {isPlayingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          
          <div className="min-w-0 flex-1 leading-tight text-xs">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              {isPlayingAudio ? (
                <>
                  <span className="flex space-x-0.5 items-end h-2 w-2 mb-0.5">
                    <span className="w-0.5 h-full bg-emerald-400 animate-[pulse_0.8s_infinite]" />
                    <span className="w-0.5 h-2/3 bg-emerald-400 animate-[pulse_0.5s_infinite]" />
                    <span className="w-0.5 h-full bg-emerald-400 animate-[pulse_0.9s_infinite]" />
                  </span>
                  Streaming Audio
                </>
              ) : 'Stream Paused'}
            </p>
            <p className="font-bold text-zinc-200 truncate">{activeChannel?.name || "Dubstep"}</p>
          </div>

          <div className="flex items-center space-x-1.5 pr-1">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition">
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-12 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </header>

      {playerError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 px-6 py-2 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            {playerError}
          </span>
          <button onClick={() => setPlayerError(null)} className="font-bold underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* DASHBOARD WORKSPACE */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* LEFT COLUMN: SETTINGS PANEL & CHANNELS INDEX */}
        <section className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg flex flex-col h-full overflow-hidden" id="dashboard-left-panel">
          {/* Workspace Tabs */}
          <div className="flex border-b border-zinc-800 bg-zinc-950/40">
            <button 
              onClick={() => setTab('settings')}
              className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                tab === 'settings' 
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/[0.02]' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Overlay Customizer</span>
            </button>
            <button 
              onClick={() => setTab('channels')}
              className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                tab === 'channels' 
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/[0.02]' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio className="h-4 w-4" />
              <span>DI.FM Channels ({channels.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {tab === 'settings' ? (
              <>
                {/* 1. INPUT STREAM LINK */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">1. Stream Link or Channel Key</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      placeholder="Paste DI.FM URL or Key..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button 
                      onClick={() => handleUrlSubmit(streamUrl)}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold px-3 py-2 rounded-lg transition"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Active channel: <strong className="text-emerald-400">{activeChannel?.name || "Custom"}</strong>
                  </p>
                </div>

                {/* 2. CHOOSE LAYOUT PRESET */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">2. Widget Layout</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['classic', 'compact', 'sidebar', 'retro', 'marquee'] as LayoutPreset[]).map((lay) => (
                      <button
                        key={lay}
                        onClick={() => updateConfigValue('layout', lay)}
                        className={`py-2 px-1 text-[10px] font-bold border rounded-lg transition flex flex-col items-center justify-center gap-1.5 uppercase ${
                          config.layout === lay 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <Layers className="h-4 w-4" />
                        <span>{lay}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. TYPOGRAPHY & SCHEME */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">3. Visual Style</label>
                    <button 
                      onClick={() => setConfig(DEFAULT_CONFIG)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold underline"
                    >
                      Reset Style
                    </button>
                  </div>

                  {/* Fonts */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500">Typography Font</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['sans', 'display', 'mono', 'serif'] as FontStyle[]).map((font) => (
                        <button
                          key={font}
                          onClick={() => updateConfigValue('font', font)}
                          className={`py-1.5 px-1 text-[10px] font-bold border rounded transition uppercase ${
                            config.font === font 
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colors Grids */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 block">Bg Color</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={config.bgColor} 
                          onChange={(e) => updateConfigValue('bgColor', e.target.value)}
                          className="h-7 w-7 rounded bg-transparent cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.bgColor} 
                          onChange={(e) => updateConfigValue('bgColor', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 block">Accent Color</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={config.accentColor} 
                          onChange={(e) => updateConfigValue('accentColor', e.target.value)}
                          className="h-7 w-7 rounded bg-transparent cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.accentColor} 
                          onChange={(e) => updateConfigValue('accentColor', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 block">Text Color</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={config.textColor} 
                          onChange={(e) => updateConfigValue('textColor', e.target.value)}
                          className="h-7 w-7 rounded bg-transparent cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.textColor} 
                          onChange={(e) => updateConfigValue('textColor', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 block">Progress Bar Color</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={config.progressColor} 
                          onChange={(e) => updateConfigValue('progressColor', e.target.value)}
                          className="h-7 w-7 rounded bg-transparent cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={config.progressColor} 
                          onChange={(e) => updateConfigValue('progressColor', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Range Sliders */}
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                        <span>Background Opacity</span>
                        <span>{config.bgOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={config.bgOpacity}
                        onChange={(e) => updateConfigValue('bgOpacity', parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                        <span>Border Radius</span>
                        <span>{config.borderRadius}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="24" 
                        value={config.borderRadius}
                        onChange={(e) => updateConfigValue('borderRadius', parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Display options Toggles */}
                  <div className="grid grid-cols-2 gap-4 pt-1.5">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={config.showProgress}
                        onChange={(e) => updateConfigValue('showProgress', e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] font-semibold text-zinc-400">Render Progress</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={config.animateOnChange}
                        onChange={(e) => updateConfigValue('animateOnChange', e.target.checked)}
                        className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] font-semibold text-zinc-400">Animate Change</span>
                    </label>
                  </div>
                </div>

                {/* 4. CUSTOM CSS */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">4. Custom CSS Override (Optional)</label>
                  <textarea
                    value={config.customCss}
                    onChange={(e) => updateConfigValue('customCss', e.target.value)}
                    placeholder="e.g. #overlay-classic { text-shadow: 0 2px 4px rgba(0,0,0,0.5); }"
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg p-2 text-xs font-mono text-zinc-300 focus:outline-none"
                  />
                </div>
              </>
            ) : (
              // DI.FM CHANNELS INDEX TAB
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search music channels (DNB, Trance, Dubstep...)"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {filteredChannels.length === 0 ? (
                    <p className="text-center text-xs text-zinc-500 py-6">No matching DI.FM channels found.</p>
                  ) : (
                    filteredChannels.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectChannel(c)}
                        className={`flex items-center p-2.5 rounded-lg text-left border transition ${
                          activeChannel?.id === c.id 
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200' 
                            : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {c.asset_url ? (
                          <img 
                            src={c.asset_url} 
                            alt={c.name} 
                            className="w-9 h-9 object-cover rounded-md mr-3 border border-zinc-800"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-zinc-850 flex items-center justify-center mr-3 border border-zinc-800">
                            <Radio className="h-4 w-4 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold truncate">{c.name}</h4>
                          <p className="text-[10px] text-zinc-500 truncate">{c.description}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC OBS COPY INTEGRATION CARD */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 space-y-3">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">OBS Studio Browser Source URL</span>
              <p className="text-[10px] text-zinc-500">Copy this URL and add it as a new Browser Source in OBS Studio</p>
            </div>
            <div className="flex bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
              <input 
                type="text" 
                readOnly 
                value={generateOverlayUrl()}
                className="flex-1 bg-transparent px-3 py-2 text-[10px] font-mono text-zinc-400 overflow-x-auto whitespace-nowrap focus:outline-none"
              />
              <button 
                onClick={copyUrlToClipboard}
                className={`px-4 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: PREVIEW STAGE & MUSIC TIMELINE */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* A. STAGE VIEW (TRANSPARENT CHECKBOARD BACKDROP) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col shadow-lg" id="dashboard-stage-card">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <Eye className="h-4.5 w-4.5 text-zinc-400" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Broadcast Preview</h3>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded font-bold uppercase">
                OBS Screen Preview
              </span>
            </div>

            {/* Checkered Stage Background */}
            <div className="relative w-full aspect-[16/7] rounded-lg border border-zinc-850 overflow-hidden flex items-center justify-center p-4 bg-checkerboard" id="stage-viewport">
              <OverlayRenderer previewConfig={config} previewTrack={currentTrack} />
            </div>

            {/* Checkerboard CSS pattern helper */}
            <style>{`
              .bg-checkerboard {
                background-color: #0b0b0c;
                background-image: 
                  linear-gradient(45deg, #151518 25%, transparent 25%), 
                  linear-gradient(-45deg, #151518 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #151518 75%), 
                  linear-gradient(-45deg, transparent 75%, #151518 75%);
                background-size: 20px 20px;
                background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
              }
            `}</style>

            <div className="flex items-center gap-2 mt-3 p-3 bg-zinc-950/50 border border-zinc-850 rounded-lg text-[11px] text-zinc-400">
              <Info className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />
              <span>The chessboard grid demonstrates transparency. In OBS, the checkered pattern will be completely transparent, leaving only the beautiful music widget visible.</span>
            </div>
          </div>

          {/* B. NOW PLAYING DETAILED METADATA CARD */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex-1 flex flex-col justify-between" id="dashboard-timeline-card">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Music className="h-4 w-4 text-emerald-400" />
                  Live Stream Timeline
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">TRACK ID: {currentTrack?.track_id || "..."}</span>
              </div>

              {currentTrack ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Track art larger */}
                  <div className="md:col-span-3 flex justify-center">
                    {currentTrack.art_url ? (
                      <img 
                        src={currentTrack.art_url} 
                        alt="Art" 
                        className="w-24 h-24 object-cover rounded-lg shadow-xl border border-zinc-800"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-zinc-850 flex items-center justify-center border border-zinc-800 text-zinc-600">
                        <Music className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  {/* Metadata fields */}
                  <div className="md:col-span-9 space-y-2">
                    <div>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                        Artist Name
                      </span>
                      <h2 className="text-base font-extrabold text-white leading-tight mt-1">{currentTrack.artist}</h2>
                    </div>

                    <div>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                        Track Title
                      </span>
                      <h3 className="text-sm font-bold text-zinc-200 leading-tight mt-1">{currentTrack.title}</h3>
                    </div>

                    {currentTrack.release && (
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase block">Album / Release</span>
                        <span className="text-xs text-zinc-400 italic">{currentTrack.release}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 text-center">
                  <Disc className="animate-spin h-8 w-8 mb-2 opacity-50" />
                  <p className="text-xs">Awaiting broadcast stream metadata...</p>
                </div>
              )}
            </div>

            {/* QUICK OBS STEPS LIST */}
            <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
              <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-850/50">
                <span className="text-emerald-400 font-bold block mb-0.5">1. Add Browser Source</span>
                <p className="text-zinc-500">In OBS Studio, click (+) under Sources and choose "Browser".</p>
              </div>
              <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-850/50">
                <span className="text-emerald-400 font-bold block mb-0.5">2. Paste Overlay URL</span>
                <p className="text-zinc-500">Paste the generated copy URL inside the URL parameter field.</p>
              </div>
              <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-850/50">
                <span className="text-emerald-400 font-bold block mb-0.5">3. Set Best Canvas</span>
                <p className="text-zinc-500">For classic, set width 450, height 180. For sidebar, set 260x420.</p>
              </div>
            </div>

          </div>

        </section>

      </main>
    </div>
  );
}

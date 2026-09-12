import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Disc, Server } from "lucide-react";
import { OverlayConfig, TrackInfo, FontStyle, LayoutPreset } from "../types";

interface OverlayRendererProps {
  previewConfig?: OverlayConfig;
  previewTrack?: TrackInfo | null;
}

export default function OverlayRenderer({ previewConfig, previewTrack }: OverlayRendererProps) {
  const [config, setConfig] = useState<OverlayConfig | null>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse config from URL search parameters if in standalone mode (no props provided)
  useEffect(() => {
    if (previewConfig) {
      setConfig(previewConfig);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const customConfig: OverlayConfig = {
      layout: (params.get("layout") as LayoutPreset) || "classic",
      font: (params.get("font") as FontStyle) || "sans",
      bgColor: params.get("bgColor") || "#09090b",
      bgOpacity: params.has("bgOpacity") ? Number(params.get("bgOpacity")) : 85,
      textColor: params.get("textColor") || "#f4f4f5",
      accentColor: params.get("accentColor") || "#10b981",
      borderRadius: params.has("borderRadius") ? Number(params.get("borderRadius")) : 12,
      showProgress: params.get("showProgress") !== "false",
      animateOnChange: params.get("animateOnChange") !== "false",
      progressColor: params.get("progressColor") || "#10b981",
      customCss: params.get("customCss") || "",
    };

    setConfig(customConfig);
    setLoading(false);
  }, [previewConfig]);

  // Handle track data (polling if in standalone mode, otherwise use prop)
  useEffect(() => {
    if (previewTrack !== undefined) {
      setTrack(previewTrack);
      setError(null);
      return;
    }

    // Polling mode for OBS Browser Source
    const params = new URLSearchParams(window.location.search);
    const streamUrl = params.get("url") || "";
    const channelKey = params.get("key") || "dubstep";

    if (!streamUrl && !channelKey) {
      setError("No stream URL or channel key provided.");
      return;
    }

    const fetchTrack = async () => {
      try {
        const queryParam = streamUrl 
          ? `url=${encodeURIComponent(streamUrl)}` 
          : `key=${encodeURIComponent(channelKey)}`;
        
        const response = await fetch(`/api/now-playing?${queryParam}`);
        if (!response.ok) {
          throw new Error("Failed to fetch live track metadata");
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setTrack(data.track);
        setError(null);
      } catch (err: any) {
        console.error("Error polling metadata:", err);
        setError(err.message || "Failed to load music metadata.");
      }
    };

    fetchTrack();
    const pollInterval = setInterval(fetchTrack, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [previewTrack]);

  // Client-side smooth track progress increments (ticking every second)
  useEffect(() => {
    if (!track || track.duration <= 0) return;

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      setTrack((prev) => {
        if (!prev) return null;
        const newElapsed = Math.min(prev.duration, prev.elapsed + 1);
        const newRemaining = Math.max(0, prev.duration - newElapsed);
        const newPercent = (newElapsed / prev.duration) * 100;
        return {
          ...prev,
          elapsed: newElapsed,
          remaining: newRemaining,
          progressPercent: newPercent,
        };
      });
    }, 1000);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [track?.track_id, track?.started]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent text-zinc-400 font-sans">
        <Server className="animate-spin mr-2 h-5 w-5" />
        <span>Loading overlay...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent text-red-400 font-sans p-4 text-center text-sm">
        <div className="bg-zinc-950/90 border border-red-500/30 rounded-lg p-3 max-w-sm shadow-lg">
          <p className="font-semibold mb-1">Overlay Error</p>
          <p className="text-zinc-400 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!config) return null;

  // Custom Font Classes
  const getFontClass = () => {
    switch (config.font) {
      case "display":
        return "font-sans uppercase tracking-wider font-extrabold";
      case "mono":
        return "font-mono";
      case "serif":
        return "font-serif";
      case "sans":
      default:
        return "font-sans";
    }
  };

  // Convert Hex to RGBA for transparent backgrounds
  const getBgColorWithOpacity = (hex: string, opacityPercent: number) => {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
  };

  const containerStyle = {
    backgroundColor: getBgColorWithOpacity(config.bgColor, config.bgOpacity),
    color: config.textColor,
    borderRadius: `${config.borderRadius}px`,
    borderColor: config.accentColor + "40", // 25% opacity border
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const renderProgress = () => {
    if (!config.showProgress || !track || track.duration <= 0) return null;

    // Custom layout representation of progress bar for retro vs standard
    if (config.layout === "retro") {
      const barLength = 20;
      const filledLength = Math.round((track.progressPercent / 100) * barLength);
      const filled = "=".repeat(Math.max(0, filledLength - 1)) + ">";
      const empty = " ".repeat(Math.max(0, barLength - filledLength));
      return (
        <div className="text-[10px] font-mono mt-2 flex items-center justify-between opacity-80" id="progress-retro">
          <span>[{filled.padEnd(barLength, " ").substring(0, barLength)}]</span>
          <span className="ml-2">{Math.round(track.progressPercent)}%</span>
        </div>
      );
    }

    return (
      <div className="mt-2 w-full" id="progress-standard">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: config.progressColor }}
            animate={{ width: `${track.progressPercent}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1 opacity-60 font-medium">
          <span>{formatTime(track.elapsed)}</span>
          <span>-{formatTime(track.remaining)}</span>
        </div>
      </div>
    );
  };

  // Inline animations definition based on animateOnChange setting
  const animateProps = config.animateOnChange
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
        transition: { duration: 0.4, ease: "easeInOut" },
      }
    : { initial: {}, animate: {}, exit: {}, transition: {} };

  // Render Layouts
  return (
    <>
      {/* Inject custom CSS if any */}
      {config.customCss && <style>{config.customCss}</style>}

      <div className={`w-full h-full flex items-center justify-center bg-transparent ${getFontClass()}`}>
        <AnimatePresence mode="wait">
          {!track ? (
            <motion.div
              key="no-track"
              className="flex items-center p-4 border shadow-xl bg-zinc-950/80 border-zinc-800"
              style={{ borderRadius: `${config.borderRadius}px` }}
              {...animateProps}
              id="no-track-card"
            >
              <Disc className="animate-spin text-zinc-500 mr-3 h-8 w-8" />
              <div>
                <p className="text-sm font-semibold opacity-90">Waiting for stream...</p>
                <p className="text-xs opacity-50">Stream metadata will sync shortly.</p>
              </div>
            </motion.div>
          ) : (
            <div key={track.track_id || `${track.artist}-${track.title}`} className="w-full max-w-full">
              
              {/* LAYOUT 1: CLASSIC OVERLAY */}
              {config.layout === "classic" && (
                <motion.div
                  className="flex flex-col border shadow-2xl overflow-hidden p-3 w-[420px] max-w-full"
                  style={containerStyle}
                  {...animateProps}
                  id="overlay-classic"
                >
                  <div className="flex items-center space-x-4">
                    {/* Album Art */}
                    <div className="relative flex-shrink-0">
                      {track.art_url ? (
                        <img
                          src={track.art_url}
                          alt="Album Art"
                          className="w-16 h-16 object-cover shadow-md"
                          style={{ borderRadius: `${Math.min(config.borderRadius, 12)}px` }}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 flex items-center justify-center bg-white/5 border border-white/10"
                          style={{ borderRadius: `${Math.min(config.borderRadius, 12)}px` }}
                        >
                          <Music className="w-6 h-6 opacity-40" />
                        </div>
                      )}
                      <div
                        className="absolute -bottom-1 -right-1 p-1 rounded-full text-[10px] font-bold shadow-md border border-white/10"
                        style={{ backgroundColor: config.accentColor, color: "#fff" }}
                      >
                        <Disc className="w-3 h-3 animate-spin" />
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div className="min-w-0 flex-1">
                      <motion.h4
                        className="text-sm font-bold truncate pr-2"
                        style={{ color: config.textColor }}
                      >
                        {track.title}
                      </motion.h4>
                      <motion.p
                        className="text-xs font-semibold truncate opacity-80"
                        style={{ color: config.accentColor }}
                      >
                        {track.artist}
                      </motion.p>
                      {track.release && (
                        <p className="text-[10px] opacity-50 truncate mt-0.5">
                          {track.release}
                        </p>
                      )}
                    </div>
                  </div>
                  {renderProgress()}
                </motion.div>
              )}

              {/* LAYOUT 2: COMPACT PILL */}
              {config.layout === "compact" && (
                <motion.div
                  className="flex flex-col border shadow-lg overflow-hidden py-2 px-3 w-[340px] max-w-full"
                  style={{
                    ...containerStyle,
                    borderRadius: `${config.borderRadius > 12 ? 9999 : config.borderRadius}px`
                  }}
                  {...animateProps}
                  id="overlay-compact"
                >
                  <div className="flex items-center space-x-3">
                    {track.art_url ? (
                      <img
                        src={track.art_url}
                        alt="Album Art"
                        className="w-10 h-10 object-cover rounded-full flex-shrink-0 border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full flex-shrink-0 border border-white/10">
                        <Music className="w-4 h-4 opacity-40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 leading-tight">
                      <h4 className="text-xs font-extrabold truncate">{track.title}</h4>
                      <p className="text-[11px] font-semibold truncate opacity-80" style={{ color: config.accentColor }}>
                        {track.artist}
                      </p>
                    </div>
                  </div>
                  {renderProgress()}
                </motion.div>
              )}

              {/* LAYOUT 3: SIDEBAR PANEL */}
              {config.layout === "sidebar" && (
                <motion.div
                  className="flex flex-col border shadow-2xl p-4 w-[240px]"
                  style={containerStyle}
                  {...animateProps}
                  id="overlay-sidebar"
                >
                  <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-white/10 mb-3">
                    {track.art_url ? (
                      <img
                        src={track.art_url}
                        alt="Album Art"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5">
                        <Music className="w-12 h-12 opacity-30 animate-pulse" />
                      </div>
                    )}
                    <div
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider flex items-center space-x-1"
                      style={{ backgroundColor: `${config.accentColor}dd`, color: "#fff" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>LIVE</span>
                    </div>
                  </div>

                  <div className="min-w-0 text-center mb-1">
                    <h4 className="text-sm font-bold truncate leading-snug">{track.title}</h4>
                    <p className="text-xs font-semibold truncate mt-0.5" style={{ color: config.accentColor }}>
                      {track.artist}
                    </p>
                    {track.release && (
                      <p className="text-[10px] opacity-40 truncate mt-1 italic">
                        {track.release}
                      </p>
                    )}
                  </div>

                  {renderProgress()}
                </motion.div>
              )}

              {/* LAYOUT 4: RETRO CONSOLE */}
              {config.layout === "retro" && (
                <motion.div
                  className="border-2 p-3 font-mono w-[380px] max-w-full uppercase text-xs"
                  style={{
                    backgroundColor: config.bgColor,
                    color: config.accentColor,
                    borderColor: config.accentColor,
                    borderRadius: "0px", // Retro is strictly flat/sharp
                    boxShadow: `0 0 10px ${config.accentColor}30`,
                  }}
                  {...animateProps}
                  id="overlay-retro"
                >
                  <div className="flex justify-between items-center border-b pb-1.5 mb-2" style={{ borderColor: config.accentColor }}>
                    <span className="font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                      SYSTEM_BROADCAST:
                    </span>
                    <span className="opacity-70 text-[9px]">ID: {track.track_id}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex">
                      <span className="opacity-50 w-16 flex-shrink-0">TITLE:</span>
                      <span className="font-bold truncate text-white">{track.title}</span>
                    </div>
                    <div className="flex">
                      <span className="opacity-50 w-16 flex-shrink-0">ARTIST:</span>
                      <span className="truncate" style={{ color: config.accentColor }}>{track.artist}</span>
                    </div>
                    {track.release && (
                      <div className="flex">
                        <span className="opacity-50 w-16 flex-shrink-0">ALBUM:</span>
                        <span className="opacity-80 truncate">{track.release}</span>
                      </div>
                    )}
                  </div>

                  {renderProgress()}
                </motion.div>
              )}

              {/* LAYOUT 5: MARQUEE TICKER */}
              {config.layout === "marquee" && (
                <motion.div
                  className="flex items-center overflow-hidden border px-3 py-1.5 w-[500px] max-w-full"
                  style={{
                    ...containerStyle,
                    borderRadius: `${config.borderRadius > 8 ? 8 : config.borderRadius}px`
                  }}
                  {...animateProps}
                  id="overlay-marquee"
                >
                  <div className="flex-shrink-0 flex items-center pr-2 mr-2 border-r border-white/10">
                    {track.art_url ? (
                      <img
                        src={track.art_url}
                        alt="Art"
                        className="w-5 h-5 object-cover rounded"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Music className="w-4 h-4 opacity-40" />
                    )}
                    <span className="text-[10px] font-bold ml-1.5 uppercase tracking-widest opacity-80" style={{ color: config.accentColor }}>
                      LIVE
                    </span>
                  </div>

                  {/* Scrolling Text Marquee container */}
                  <div className="flex-1 relative overflow-hidden h-4 whitespace-nowrap">
                    <div className="absolute animate-[marquee_20s_linear_infinite] flex space-x-12 pl-[100%]">
                      <span className="text-xs font-semibold">
                        NOW PLAYING: <strong style={{ color: config.textColor }}>{track.title}</strong> — <span style={{ color: config.accentColor }}>{track.artist}</span> {track.release ? `[${track.release}]` : ""}
                      </span>
                      <span className="text-xs font-semibold">
                        NOW PLAYING: <strong style={{ color: config.textColor }}>{track.title}</strong> — <span style={{ color: config.accentColor }}>{track.artist}</span> {track.release ? `[${track.release}]` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Simple CSS Marquee style inject helper */}
                  <style>{`
                    @keyframes marquee {
                      0% { transform: translate3d(0, 0, 0); }
                      100% { transform: translate3d(-100%, 0, 0); }
                    }
                  `}</style>
                </motion.div>
              )}

            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

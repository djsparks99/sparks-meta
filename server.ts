import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Channel {
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

interface TrackInfo {
  artist: string;
  title: string;
  release?: string;
  art_url?: string;
  started: number;
  duration: number;
  track_id: number;
}

let cachedChannels: Channel[] = [];
let lastChannelsFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchChannels(): Promise<Channel[]> {
  const now = Date.now();
  if (cachedChannels.length > 0 && (now - lastChannelsFetchTime < CACHE_TTL)) {
    return cachedChannels;
  }

  try {
    console.log("Fetching channels from DI.FM...");
    const response = await fetch("https://api.audioaddict.com/v1/di/channels.json");
    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.statusText}`);
    }
    const data = await response.json() as any[];
    cachedChannels = data.map((c: any) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      description: c.description || c.description_short || "",
      asset_url: c.asset_url || "",
      banner_url: c.banner_url || "",
      images: c.images ? {
        default: c.images.default,
        square: c.images.square,
        compact: c.images.compact,
      } : undefined
    }));
    lastChannelsFetchTime = now;
    console.log(`Successfully cached ${cachedChannels.length} channels.`);
    return cachedChannels;
  } catch (error) {
    console.error("Error fetching channels:", error);
    // Return stale cache if available, otherwise empty list
    return cachedChannels;
  }
}

function getChannelKeyFromUrl(inputUrl: string): string {
  try {
    let pathname = inputUrl.trim();
    if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
      const parsed = new URL(pathname);
      pathname = parsed.pathname;
    }
    // Remove leading and trailing slashes, keep first segment
    const segment = pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/")[0];
    // Strip extensions like .mp3 or ?query
    const key = segment.split(".")[0].split("?")[0].toLowerCase();
    return key;
  } catch (e) {
    return inputUrl.trim().toLowerCase();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Get all available channels
  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await fetchChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load channels list", details: error.message });
    }
  });

  // API Route: Get now playing track for a stream URL or channel key
  app.get("/api/now-playing", async (req, res) => {
    const { url, key: queryKey } = req.query;

    if (!url && !queryKey) {
      res.status(400).json({ error: "Please provide either a 'url' or a 'key' query parameter." });
      return;
    }

    try {
      const channels = await fetchChannels();
      let targetKey = "";

      if (queryKey) {
        targetKey = String(queryKey).trim().toLowerCase();
      } else if (url) {
        targetKey = getChannelKeyFromUrl(String(url));
      }

      const channel = channels.find(
        (c) => c.key.toLowerCase() === targetKey || c.name.toLowerCase() === targetKey
      );

      if (!channel) {
        res.status(404).json({
          error: `Channel not found for identifier '${targetKey}'.`,
          suggestedChannels: channels.slice(0, 5).map(c => ({ key: c.key, name: c.name }))
        });
        return;
      }

      // Fetch track history for this channel ID
      const historyUrl = `https://api.audioaddict.com/v1/di/track_history/channel/${channel.id}.json`;
      const historyResponse = await fetch(historyUrl);
      
      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch track history: ${historyResponse.statusText}`);
      }

      const historyData = await historyResponse.json() as any[];
      if (!historyData || historyData.length === 0) {
        res.json({
          channel,
          track: null,
          message: "No tracks currently playing or recorded."
        });
        return;
      }

      // The first track in history is the currently playing track
      const current = historyData[0];
      
      // Handle the art_url formatting
      let artUrl = current.art_url || "";
      if (artUrl && artUrl.startsWith("//")) {
        artUrl = "https:" + artUrl;
      } else if (artUrl && !artUrl.startsWith("http")) {
        artUrl = "https://cdn-images.audioaddict.com" + artUrl;
      }

      // Remove sizing placeholders from templates if any (e.g., {?size,...})
      if (artUrl) {
        artUrl = artUrl.replace(/\{\?[^}]*\}/g, "");
      }

      const started = current.started; // Unix timestamp in seconds
      const duration = current.duration || current.length || 0; // in seconds
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, nowInSeconds - started);
      const remaining = Math.max(0, duration - elapsed);
      const progressPercent = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

      res.json({
        channel: {
          id: channel.id,
          key: channel.key,
          name: channel.name,
          description: channel.description,
          asset_url: channel.asset_url,
          banner_url: channel.banner_url,
          images: channel.images,
        },
        track: {
          artist: current.artist || current.display_artist || "Unknown Artist",
          title: current.title || current.display_title || "Unknown Title",
          release: current.release || "",
          art_url: artUrl || channel.images?.square || channel.asset_url,
          started,
          duration,
          elapsed,
          remaining,
          progressPercent,
          track_id: current.track_id || 0
        }
      });
    } catch (error: any) {
      console.error("Error retrieving track:", error);
      res.status(500).json({ error: "Failed to retrieve live stream metadata", details: error.message });
    }
  });

  // Serve static files in production / Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OBS Metadata Server listening on port ${PORT}`);
  });
}

startServer();

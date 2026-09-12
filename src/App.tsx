import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import OverlayRenderer from "./components/OverlayRenderer";

export default function App() {
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    // Basic but bulletproof pathname routing
    const path = window.location.pathname;
    if (path.startsWith("/overlay")) {
      setIsOverlay(true);
    } else {
      setIsOverlay(false);
    }
  }, []);

  if (isOverlay) {
    return <OverlayRenderer />;
  }

  return <Dashboard />;
}

import { useEffect, useState, type ReactNode } from "react";
import { Marker, type LatLng } from "react-native-maps";

// A map marker that draws its own React view (e.g. the "12 min · 3.2 km" bubble).
// Android needs `tracksViewChanges` on briefly so the view gets painted, then off
// so it doesn't redraw constantly. Whenever `refreshKey` changes, tracking turns
// back on for a moment so the new content is painted.
export default function ViewMarker({
  coordinate,
  refreshKey,
  children,
}: {
  coordinate: LatLng;
  refreshKey: string;
  children: ReactNode;
}) {
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const track = settledKey !== refreshKey;

  useEffect(() => {
    const t = setTimeout(() => setSettledKey(refreshKey), 600);
    return () => clearTimeout(t);
  }, [refreshKey]);

  return (
    <Marker
      key={refreshKey}
      coordinate={coordinate}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 1 }}
      tappable={false}
    >
      {children}
    </Marker>
  );
}

import React, { forwardRef, useImperativeHandle, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapStyleElement = any;

export const Marker = forwardRef(({ coordinate, title, description, children, pinColor, style }: any, ref: any) => {
  return (
    <View style={style}>
      {children || (
        <View style={styles.defaultPin}>
          <Text style={styles.pinIcon}>📍</Text>
          {title ? <Text style={styles.pinTitle}>{title}</Text> : null}
        </View>
      )}
    </View>
  );
});

export const Circle = ({ center, radius, strokeColor, fillColor }: any) => null;
export const Polyline = ({ coordinates, strokeColor, strokeWidth }: any) => null;
export const Polygon = () => null;
export const Overlay = () => null;
export const Callout = ({ children }: any) => <View>{children}</View>;
export const CalloutSubview = ({ children }: any) => <View>{children}</View>;
export const Heatmap = () => null;
export const UrlTile = () => null;
export const WMSTile = () => null;
export const LocalTile = () => null;
export const Geojson = () => null;

export const MAP_TYPES = {
  STANDARD: "standard",
  SATELLITE: "satellite",
  HYBRID: "hybrid",
  TERRAIN: "terrain",
  NONE: "none",
  MUTEDSTANDARD: "mutedStandard",
};

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = "google";

const MapView = forwardRef(
  ({ style, initialRegion, children, customMapStyle, onPress, onLongPress }: any, ref: any) => {
    const [region, setRegion] = useState(
      initialRegion || {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    );

    useImperativeHandle(ref, () => ({
      animateCamera: (camera: any) => {
        if (camera?.center) {
          setRegion((prev: any) => ({ ...prev, ...camera.center }));
        }
      },
      fitToCoordinates: (coords: any[]) => {
        if (coords && coords.length > 0) {
          setRegion((prev: any) => ({
            ...prev,
            latitude: coords[0].latitude,
            longitude: coords[0].longitude,
          }));
        }
      },
      animateToRegion: (newRegion: any) => {
        if (newRegion) setRegion(newRegion);
      },
      setCamera: (camera: any) => {
        if (camera?.center) {
          setRegion((prev: any) => ({ ...prev, ...camera.center }));
        }
      },
    }));

    const lat = region?.latitude?.toFixed(4) || "20.5937";
    const lng = region?.longitude?.toFixed(4) || "78.9629";
    const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
      Number(lng) - 0.02
    }%2C${Number(lat) - 0.02}%2C${Number(lng) + 0.02}%2C${
      Number(lat) + 0.02
    }&layer=mapnik&marker=${lat}%2C${lng}`;

    return (
      <View style={[styles.container, style]}>
        {/* OpenStreetMap interactive web preview */}
        <iframe
          title="Web Map"
          src={mapEmbedUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            filter: "saturate(0.9) contrast(1.05)",
          }}
        />
        <View style={styles.webBadge} pointerEvents="none">
          <Text style={styles.webBadgeText}>🌐 Web Map Preview ({lat}, {lng})</Text>
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {children}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F3F0EB",
    overflow: "hidden",
    position: "relative",
  },
  webBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E1DA",
    zIndex: 10,
  },
  webBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  defaultPin: {
    alignItems: "center",
  },
  pinIcon: {
    fontSize: 24,
  },
  pinTitle: {
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});

export const AnimatedMapView = MapView;
export const Animated = MapView;
export const MapMarker = Marker;
export const MapOverlay = Overlay;
export const MapPolyline = Polyline;
export const MapCircle = Circle;
export const MapPolygon = Polygon;
export const MapCallout = Callout;

export default MapView;

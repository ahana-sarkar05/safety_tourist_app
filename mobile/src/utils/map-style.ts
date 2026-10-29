import type { MapStyleElement } from "react-native-maps";

// Google Maps styling (Android). Soft cream land, white roads, muted labels,
// and no clutter from shops so landmarks and the route stand out.
export const WARM_MAP_STYLE: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#F6EEE7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7A5C4F" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FBF4EE" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E5D2C6" }],
  },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#DCE8D2" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#EBDACE" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#F7DCC8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#EBC4A8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#CFE3EA" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6E8FA0" }],
  },
  { featureType: "transit.line", stylers: [{ visibility: "off" }] },
];

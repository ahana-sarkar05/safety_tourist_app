import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

// Shield with a plane: the Trevora brand mark.
export default function Logo({ size = 96, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Trevora logo">
      <Svg width={size} height={size} viewBox="0 0 100 104" style={{ position: "absolute" }}>
        <Path
          d="M50 5 L90 19 V50 C90 76 73 92 50 100 C27 92 10 76 10 50 V19 Z"
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </Svg>
      <Ionicons name="airplane" size={size * 0.42} color={color} style={{ marginTop: -size * 0.04 }} />
    </View>
  );
}

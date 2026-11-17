import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { theme } from "../constants/app-theme";

// A soft palace-and-minarets silhouette, echoing the design reference.
export default function Skyline({
  color = theme.colors.primary,
  opacity = 0.22,
  height = 110,
}: {
  color?: string;
  opacity?: number;
  height?: number;
}) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 400 130" preserveAspectRatio="xMidYMax slice" pointerEvents="none">
      <G fill={color} opacity={opacity}>
        {/* ground */}
        <Rect x={0} y={118} width={400} height={12} />
        {/* central palace and its dome */}
        <Rect x={140} y={70} width={120} height={48} />
        <Path d="M152 70 C152 24 248 24 248 70 Z" />
        <Rect x={198} y={14} width={4} height={14} />
        <Circle cx={200} cy={12} r={4} />
        {/* small domed turrets on the palace */}
        <Path d="M138 70 V58 C138 46 154 46 154 58 V70 Z" />
        <Path d="M246 70 V58 C246 46 262 46 262 58 V70 Z" />
        {/* side wings with domes */}
        <Rect x={70} y={88} width={70} height={30} />
        <Rect x={260} y={88} width={70} height={30} />
        <Path d="M90 88 C90 70 120 70 120 88 Z" />
        <Path d="M280 88 C280 70 310 70 310 88 Z" />
        {/* minarets */}
        <Rect x={36} y={40} width={8} height={78} />
        <Path d="M34 40 C34 28 46 28 46 40 Z" />
        <Rect x={39.2} y={22} width={1.6} height={8} />
        <Rect x={356} y={40} width={8} height={78} />
        <Path d="M354 40 C354 28 366 28 366 40 Z" />
        <Rect x={359.2} y={22} width={1.6} height={8} />
        {/* far towers */}
        <Rect x={10} y={96} width={18} height={22} />
        <Path d="M8 96 C8 84 30 84 30 96 Z" />
        <Rect x={372} y={96} width={18} height={22} />
        <Path d="M370 96 C370 84 392 84 392 96 Z" />
      </G>
    </Svg>
  );
}

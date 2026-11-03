import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";

interface QrCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function QrCode({
  value,
  size = 180,
  color = "#1F2937",
  backgroundColor = "#FFFFFF",
}: QrCodeProps) {
  const matrix = useMemo(() => {
    const N = 25;
    const grid: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[r0 + r][c0 + c] = 1;
          } else {
            grid[r0 + r][c0 + c] = 0;
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    for (let i = 0; i < 8; i++) {
      grid[7][i] = 0;
      grid[i][7] = 0;
      grid[7][N - 1 - i] = 0;
      grid[i][N - 8] = 0;
      grid[N - 8][i] = 0;
      grid[N - 1 - i][7] = 0;
    }

    for (let i = 8; i < N - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0;
      grid[i][6] = i % 2 === 0 ? 1 : 0;
    }

    const ar0 = 16;
    const ac0 = 16;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (
          Math.abs(r) === 2 ||
          Math.abs(c) === 2 ||
          (r === 0 && c === 0)
        ) {
          grid[ar0 + r][ac0 + c] = 1;
        } else {
          grid[ar0 + r][ac0 + c] = 0;
        }
      }
    }

    let seed = 0;
    for (let i = 0; i < value.length; i++) {
      seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
    }

    let state = seed || 123456789;
    const nextRandom = () => {
      state = (1103515245 * state + 12345) & 0x7fffffff;
      return state;
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= N - 8) ||
          (r >= N - 8 && c < 8) ||
          (r === 6 || c === 6) ||
          (r >= 14 && r <= 18 && c >= 14 && c <= 18)
        ) {
          continue;
        }
        grid[r][c] = (nextRandom() % 100) > 48 ? 1 : 0;
      }
    }

    return grid;
  }, [value]);

  const N = matrix.length;
  const cellSize = size / N;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor,
        },
      ]}
    >
      {matrix.map((row, r) => (
        <View key={`row-${r}`} style={{ flexDirection: "row", height: cellSize }}>
          {row.map((cell, c) => (
            <View
              key={`cell-${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cell === 1 ? color : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";

type Props = Pick<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "keyboardType" | "autoCapitalize" | "autoComplete" | "textContentType" | "returnKeyType" | "onSubmitEditing" | "maxLength"
> & {
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean; // password field with a show/hide eye
  label: string; // for screen readers
};

// A rounded input with a leading icon, like the sign-up and login screens in the design.
export default function AuthField({ icon, secure = false, label, ...input }: Props) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={20} color={theme.colors.muted} />
      <TextInput
        {...input}
        style={styles.input}
        placeholderTextColor={theme.colors.muted}
        secureTextEntry={hidden}
        autoCorrect={false}
        accessibilityLabel={label}
      />
      {secure && (
        <Pressable
          onPress={() => setHidden((h) => !h)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
        >
          <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={theme.colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 27,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, color: theme.colors.ink, paddingVertical: 0 },
});

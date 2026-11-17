import { Alert, Platform } from "react-native";

// Alert.alert does nothing in a browser, which silently broke validation and
// delete confirmations when the app ran on web. These work on both.

export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
};

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title)
    );
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelText ?? "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: opts.confirmText,
          style: opts.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

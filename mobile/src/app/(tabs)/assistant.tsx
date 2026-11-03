import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../constants/app-theme";
import { useLocation } from "../../context/location-context";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_CHATBOT_API_URL || "http://localhost:8000"
).replace(/\/$/, "");
const GREETING =
  "Hi! I'm SafeTrip Buddy. Ask me about places, safety or itineraries.";
const CLIENT_ID_KEY = "safetrip_chat_client_id";
const CHAT_ID_KEY = "safetrip_chat_id";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const { location } = useLocation();
  const scrollView = useRef<ComponentRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [clientId, setClientId] = useState("");
  const [chatId, setChatId] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const [savedClientId, savedChatId] = await Promise.all([
          AsyncStorage.getItem(CLIENT_ID_KEY),
          AsyncStorage.getItem(CHAT_ID_KEY),
        ]);
        const nextClientId = savedClientId || createId();
        const nextChatId = savedChatId || createId();

        await Promise.all([
          savedClientId
            ? Promise.resolve()
            : AsyncStorage.setItem(CLIENT_ID_KEY, nextClientId),
          savedChatId
            ? Promise.resolve()
            : AsyncStorage.setItem(CHAT_ID_KEY, nextChatId),
        ]);
        if (!active) return;

        setClientId(nextClientId);
        setChatId(nextChatId);

        const response = await fetch(
          `${API_BASE_URL}/api/history/${encodeURIComponent(nextClientId)}/${encodeURIComponent(nextChatId)}`
        );
        if (!response.ok) {
          throw new Error(`Couldn't load chat history (${response.status}).`);
        }
        const data = (await response.json()) as {
          messages: { role: string; content: string }[];
        };
        if (active && data.messages.length > 0) {
          setMessages(
            data.messages.map((message) => ({
              role: message.role === "user" ? "user" : "assistant",
              content: message.content,
            }))
          );
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't connect to SafeTrip Buddy."
          );
        }
      } finally {
        if (active) setReady(true);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || sending || !ready || !clientId || !chatId) return;

    setInput("");
    setSending(true);
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: message },
      { role: "assistant", content: "Thinking..." },
    ]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          chat_id: chatId,
          message,
          ...(location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        let detail = `Request failed (${response.status}).`;
        try {
          const data = (await response.json()) as { detail?: string };
          if (data.detail) detail = data.detail;
        } catch {
          // Keep the HTTP status message when the server does not return JSON.
        }
        throw new Error(detail);
      }

      const reply = (await response.text()).trim();
      setMessages((current) => [
        ...current.slice(0, -1),
        {
          role: "assistant",
          content: reply || "No reply received. Please try again.",
        },
      ]);
    } catch (reason) {
      const detail =
        reason instanceof Error
          ? reason.message
          : "Couldn't reach SafeTrip Buddy.";
      setError(detail);
      setMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", content: `Couldn't send your message. ${detail}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>SafeTrip Buddy</Text>
        <Text style={styles.subtitle}>Your personal travel companion</Text>
      </View>

      <ScrollView
        ref={scrollView}
        style={styles.messages}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scrollView.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message, index) => (
          <View
            key={`${index}-${message.role}`}
            style={[
              styles.message,
              message.role === "user" ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === "user" && styles.userMessageText,
              ]}
            >
              {message.content}
            </Text>
          </View>
        ))}
        {!ready && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your chat...</Text>
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about places, safety, itinerary..."
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          multiline
          maxLength={2000}
          editable={ready && !sending}
          returnKeyType="send"
          onSubmitEditing={() => void sendMessage()}
          accessibilityLabel="Message SafeTrip Buddy"
        />
        <Pressable
          onPress={() => void sendMessage()}
          disabled={!input.trim() || !ready || sending}
          style={[
            styles.sendButton,
            (!input.trim() || !ready || sending) && styles.sendButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons name="send" size={19} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.colors.bg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.muted,
    marginTop: 4,
  },
  messages: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  messageList: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  message: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 5,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.bg,
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  loading: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  error: {
    color: theme.colors.coral,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.ink,
    fontSize: 15,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

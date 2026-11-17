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
import Constants from "expo-constants";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// ---------------------------------------------------------------------------
// Chatbot URL — mirrors the same resolution logic as getApiBase() in
// identity.ts, but targets port 8001 (the Gemini chatbot service).
// ---------------------------------------------------------------------------
const CHATBOT_PORT = 8001;

function getChatbotBase(): string {
  // Web: use window.location.hostname
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host === "localhost" || host === "127.0.0.1" ? "localhost" : host}:${CHATBOT_PORT}`;
  }

  // Explicit non-localhost env override (e.g. tunnel or remote deployment)
  const envUrl = (process.env.EXPO_PUBLIC_CHATBOT_API_URL ?? "").trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  // Expo Go on a physical device: Metro advertises the PC's LAN IP via hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && !hostUri.includes("ngrok") && !hostUri.includes("expo.dev")) {
    const hostIp = hostUri.split(":")[0];
    return `http://${hostIp}:${CHATBOT_PORT}`;
  }

  // Android emulator loopback
  if (Platform.OS === "android") {
    return `http://10.0.2.2:${CHATBOT_PORT}`;
  }

  return `http://localhost:${CHATBOT_PORT}`;
}

const CHATBOT_BASE = getChatbotBase();

const GREETING =
  "Hi! I'm Trevora AI, your smart travel and safety assistant. Ask me about destinations, real-time safety, local culture, food or itineraries!";
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
          `${CHATBOT_BASE}/api/history/${encodeURIComponent(nextClientId)}/${encodeURIComponent(nextChatId)}`
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
      } catch {
        // Backend history offline or starting: start with clean greeting without error banner
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

    // Add user message + empty assistant placeholder immediately
    setMessages((current) => [
      ...current,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch(`${CHATBOT_BASE}/api/chat`, {
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

      // Stream the response body chunk by chunk, updating the last message live.
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        // Fallback: no streaming support — read whole body at once.
        const text = await response.text();
        setMessages((current) => [
          ...current.slice(0, -1),
          { role: "assistant", content: text.trim() || "No reply received. Please try again." },
        ]);
      } else {
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snap = accumulated; // capture for closure
          setMessages((current) => [
            ...current.slice(0, -1),
            { role: "assistant", content: snap },
          ]);
        }
        // Flush any remaining bytes
        accumulated += decoder.decode();
        if (accumulated) {
          setMessages((current) => [
            ...current.slice(0, -1),
            { role: "assistant", content: accumulated },
          ]);
        }
        if (!accumulated.trim()) {
          setMessages((current) => [
            ...current.slice(0, -1),
            { role: "assistant", content: "No reply received. Please try again." },
          ]);
        }
      }
    } catch {
      // Local fallback assistant response when backend is unreachable
      let fallback = "";
      const lower = message.toLowerCase();
      if (
        lower.includes("emergency") ||
        lower.includes("police") ||
        lower.includes("sos") ||
        lower.includes("help") ||
        lower.includes("danger") ||
        lower.includes("lost")
      ) {
        fallback =
          "🚨 **Emergency Assistance**:\n• Call **112** for Pan-India Police & Emergency response.\n• Call **108** for Medical Ambulance.\n• Press the red **SOS Button** on the app home screen to broadcast your live GPS to trusted contacts.\n• Stay in well-lit public areas or verified hotel lobbies.";
      } else if (lower.includes("taj") || lower.includes("agra")) {
        fallback =
          "🏛️ **Taj Mahal & Agra Guide**:\n• Timing: Open 30 minutes before sunrise to 30 minutes before sunset (closed Fridays).\n• Ticket: Book online at asi.nic.in to skip long queues.\n• Safety: Only hire ASI-certified tour guides with government photo identity badges.";
      } else if (lower.includes("kochi") || lower.includes("kerala")) {
        fallback =
          "🌴 **Fort Kochi & Kerala Travel Guide**:\n• Explore Chinese Fishing Nets, St. Francis Church, and Jew Town.\n• Enjoy the Kochi Water Metro for modern, safe water transit.\n• Tourist Police facilitation booths are active throughout the promenade.";
      } else if (lower.includes("itinerary") || lower.includes("plan") || lower.includes("days")) {
        fallback =
          "🗺️ **2-Day Recommended Safe Itinerary (Est. ₹2,200/day)**:\n• **Day 1**: Morning heritage monuments walk → Afternoon museum visit → Evening cultural performance.\n• **Day 2**: Nature or coastal excursion → Local bazaar shopping with metered rides.\n• **Safety Tip**: Use app-based cabs (Uber/Ola) for transparent pricing.";
      } else if (lower.includes("scam") || lower.includes("precaution") || lower.includes("night")) {
        fallback =
          "🛡️ **Safety & Scam Prevention Tips**:\n• Always use metered taxis or prepaid airport/railway booths.\n• Keep photocopies or digital verifiable copies of your ID in the **Tourist ID** tab.\n• Avoid poorly lit or deserted streets after 10 PM in unfamiliar neighborhoods.";
      } else {
        fallback =
          "Hello! I'm **Trevora AI**, your personal travel and safety companion. I can assist you with:\n• 📍 Itinerary planning for any destination\n• 🛡️ Real-time safety scores and travel advisories\n• 🚨 Emergency numbers (112 Police, 108 Ambulance)\n• 🍲 Authentic food & verified cultural attractions\n\n*(Chatbot service is currently offline — start the chatbot backend to get AI-powered replies.)*";
      }

      setMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", content: fallback },
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
        <Text style={styles.title}>Trevora AI</Text>
        <Text style={styles.subtitle}>Your smart travel &amp; safety companion</Text>
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
          accessibilityLabel="Message Trevora AI"
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

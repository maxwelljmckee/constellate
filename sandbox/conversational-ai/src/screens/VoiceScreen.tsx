import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { GlassView } from "expo-glass-effect";
import { PhoneCall, X } from "lucide-react-native";
import { TranscriptEntry } from "../hooks/useGeminiLive";

type Props = { onExit: () => void };

const ORB_COLORS = {
  border: ["#3b82f6", "#6366f1"],
  bg: ["#1e3a5f", "#1e1b4b"],
};

export function VoiceScreen({ onExit }: Props) {
  const { connect, disconnect, isConnected, isModelSpeaking, transcript } =
    useGeminiLive();
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callEnded) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [callEnded]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const callTime = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const orbState = isModelSpeaking ? 1 : 0;
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withTiming(orbState, { duration: 400 });
  }, [orbState]);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(animValue.value, [0, 1], ORB_COLORS.border),
    backgroundColor: interpolateColor(animValue.value, [0, 1], ORB_COLORS.bg),
  }));

  const handleHangUp = () => {
    disconnect();
    setCallEnded(true);
  };

  if (callEnded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.transcriptHeader}>
          <Text style={styles.transcriptTitle}>Call summary</Text>
          <Pressable onPress={onExit} style={styles.closeButton} hitSlop={12}>
            <X size={22} color="#a1a1aa" strokeWidth={2} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {transcript.length === 0 ? (
            <Text style={styles.emptyText}>No transcript available.</Text>
          ) : (
            transcript.map((entry: TranscriptEntry, i: number) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  entry.role === "user" ? styles.userBubble : styles.modelBubble,
                ]}
              >
                <Text style={styles.bubbleLabel}>
                  {entry.role === "user" ? "You" : "Muse"}
                </Text>
                <Text style={styles.bubbleText}>{entry.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text className="text-zinc-200 text-[32px] font-semibold">
          {callTime}
        </Text>
        <Animated.View style={[styles.orb, animatedOrbStyle]} />
      </View>

      <Pressable onPress={handleHangUp}>
        <View className="bg-rose-500/40" style={styles.glassView}>
          <GlassView style={styles.glassViewInner} glassEffectStyle="clear">
            <View style={{ transform: [{ rotate: "270deg" }] }}>
              <PhoneCall size={42} strokeWidth={2.5} />
            </View>
          </GlassView>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const buttonSize = 80;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  orb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  glassView: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    height: buttonSize,
    width: buttonSize,
    borderRadius: buttonSize / 2,
  },
  glassViewInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: buttonSize,
    width: buttonSize,
    borderRadius: buttonSize / 2,
    opacity: 0.8,
  },
  // Transcript view
  transcriptHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  transcriptTitle: {
    color: "#e4e4e7",
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    right: 20,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  bubble: {
    borderRadius: 12,
    padding: 12,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: "#1e3a5f",
    alignSelf: "flex-end",
  },
  modelBubble: {
    backgroundColor: "#1c1c1e",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  bubbleLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  bubbleText: {
    color: "#e4e4e7",
    fontSize: 15,
    lineHeight: 22,
  },
  emptyText: {
    color: "#52525b",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },
});

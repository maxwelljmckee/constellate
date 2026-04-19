import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGeminiLive } from '../hooks/useGeminiLive';

type Props = { onExit: () => void };

export function VoiceScreen({ onExit }: Props) {
  const { connect, disconnect, isConnected, isModelSpeaking } = useGeminiLive();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  const status = !isConnected
    ? 'Connecting…'
    : isModelSpeaking
    ? 'Speaking…'
    : 'Listening…';

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.exitButton} onPress={onExit}>
        <Text style={styles.exitText}>End</Text>
      </Pressable>

      <View style={styles.center}>
        <View style={[styles.orb, isConnected && styles.orbConnected, isModelSpeaking && styles.orbSpeaking]} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
  },
  exitButton: {
    alignSelf: 'flex-end',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  exitText: {
    color: '#aaa',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#333',
  },
  orbConnected: {
    borderColor: '#4a9eff',
  },
  orbSpeaking: {
    backgroundColor: '#16213e',
    borderColor: '#a78bfa',
  },
  statusText: {
    color: '#ccc',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
});

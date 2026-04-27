import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CallEndedDropped } from '../../components/CallEndedDropped';
import { Orb } from '../../components/Orb';
import { useCallStore } from '../../lib/useCallStore';
import { useFakeCallDriver } from '../../lib/useFakeCallDriver';

const CONNECTING_DELAY_MS = 900;
const ENDING_DELAY_MS = 600;

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function CallScreen() {
  const status = useCallStore((s) => s.status);
  const markConnected = useCallStore((s) => s.markConnected);
  const endCall = useCallStore((s) => s.endCall);
  const reset = useCallStore((s) => s.reset);
  const markDropped = useCallStore((s) => s.markDropped);
  const startCall = useCallStore((s) => s.startCall);

  const [debugTaps, setDebugTaps] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useFakeCallDriver(status === 'connected');

  useEffect(() => {
    if (status === 'idle') startCall();
  }, [status, startCall]);

  useEffect(() => {
    if (status !== 'connecting') return;
    const t = setTimeout(markConnected, CONNECTING_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, markConnected]);

  useEffect(() => {
    if (status !== 'connected') return;
    const i = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  useEffect(() => {
    if (status !== 'ending') return;
    const t = setTimeout(() => {
      reset();
      setElapsed(0);
      router.back();
    }, ENDING_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, reset]);

  if (status === 'dropped') {
    return (
      <CallEndedDropped
        onRetry={() => {
          setElapsed(0);
          startCall();
        }}
        onDismiss={() => {
          reset();
          setElapsed(0);
          router.back();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.timer}>
            {status === 'connecting' ? 'Connecting…' : formatElapsed(elapsed)}
          </Text>
          <Pressable
            onPress={() => {
              const next = debugTaps + 1;
              setDebugTaps(next);
              if (next >= 4) {
                setDebugTaps(0);
                markDropped();
              }
            }}
          >
            <Orb />
          </Pressable>
        </View>

        <Pressable
          onPress={endCall}
          disabled={status !== 'connected'}
          style={[styles.hangup, { opacity: status === 'connected' ? 1 : 0.5 }]}
        >
          <Ionicons
            name="call"
            size={26}
            color="#fff"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  timer: {
    color: '#e4e4e7',
    fontSize: 32,
    fontWeight: '600',
  },
  hangup: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
});

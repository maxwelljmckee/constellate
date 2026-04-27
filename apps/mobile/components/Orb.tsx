import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallStore } from '../lib/useCallStore';

// Two color states. Indigo = Audri speaking; blue = idle / user speaking.
// Subtle cross-fade is the entire visual language.
const BORDER_COLORS = ['#3b82f6', '#6366f1'];
const BG_COLORS = ['#1e3a5f', '#1e1b4b'];

const ORB_SIZE = 160;

export function Orb() {
  const speaker = useCallStore((s) => s.currentSpeaker);
  const mix = useSharedValue(0);

  useEffect(() => {
    mix.value = withTiming(speaker === 'agent' ? 1 : 0, { duration: 400 });
  }, [speaker, mix]);

  const orbStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(mix.value, [0, 1], BORDER_COLORS),
    backgroundColor: interpolateColor(mix.value, [0, 1], BG_COLORS),
  }));

  return <Animated.View style={[styles.orb, orbStyle]} />;
}

const styles = StyleSheet.create({
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 2,
  },
});

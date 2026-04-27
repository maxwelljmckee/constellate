import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type PluginKind, usePluginOverlay } from '../lib/usePluginOverlay';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 280;

interface Props {
  kind: PluginKind;
  title: string;
  children: React.ReactNode;
}

// Single mounted instance per overlay; visibility comes from the store.
// Animation: slides up from bottom with backdrop fade. Origin-aware spring
// (open from tile position) is V1+.
export function PluginOverlay({ kind, title, children }: Props) {
  const open = usePluginOverlay((s) => s.open);
  const hide = usePluginOverlay((s) => s.hide);
  const isOpen = open === kind;

  const t = useSharedValue(0); // 0 = hidden, 1 = shown

  useEffect(() => {
    t.value = withTiming(isOpen ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOpen, t]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: t.value * 0.6,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - t.value) * SCREEN_HEIGHT }],
  }));

  if (!isOpen && t.value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={isOpen ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={hide} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <SafeAreaView edges={['top']} style={styles.sheetInner}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Animated.Text style={styles.title}>{title}</Animated.Text>
            <Pressable onPress={hide} style={styles.close} hitSlop={12}>
              <Ionicons name="close" size={22} color="#e8f1ff" />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 24,
    bottom: 0,
    backgroundColor: '#0a1628',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2f4d',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    color: '#e8f1ff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#11203a',
  },
  body: {
    flex: 1,
  },
});

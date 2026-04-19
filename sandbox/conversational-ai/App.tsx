import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';

import './src/nativewind/global.css';

type Screen = 'home' | 'voice';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'home' ? (
        <HomeScreen onGoLive={() => setScreen('voice')} />
      ) : (
        <VoiceScreen onExit={() => setScreen('home')} />
      )}
    </SafeAreaProvider>
  );
}

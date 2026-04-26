import { Stack } from 'expo-router';

// Main app stack — home, call, plugin overlays land here.
// Auth gate (redirect to (auth) if unauthed) added in slice 1.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

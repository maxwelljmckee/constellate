import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../lib/useSession';

// Main app stack — bounces signed-out users to sign-in.
export default function AppLayout() {
  const session = useSession();
  if (session.status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

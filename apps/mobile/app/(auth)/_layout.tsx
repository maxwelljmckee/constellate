import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../lib/useSession';

// Auth flow stack — bounces signed-in users out to (app).
export default function AuthLayout() {
  const session = useSession();
  if (session.status === 'signed-in') return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

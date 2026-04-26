import { Stack } from 'expo-router';

// Auth flow stack — sign-in, sign-up land here.
// Auth-aware redirect logic added in slice 1 (`useAuth` + Redirect components).
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

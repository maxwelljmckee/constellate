import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '../lib/useSession';

// Root redirect — sends user to (app) or (auth) based on session.
export default function Root() {
  const session = useSession();
  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-azure-bg">
        <Text className="text-azure-text-muted">Loading…</Text>
      </View>
    );
  }
  return <Redirect href={session.status === 'signed-in' ? '/(app)' : '/(auth)/sign-in'} />;
}

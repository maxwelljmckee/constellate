import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PluginTile } from '../../components/PluginTile';
import { useCallStore } from '../../lib/useCallStore';
import { firstNameFromUser, timeAwareGreeting } from '../../lib/greeting';
import { useRxdbReady } from '../../lib/rxdb/useRxdbReady';
import { supabase } from '../../lib/supabase';
import { useMe } from '../../lib/useMe';
import { usePluginOverlay } from '../../lib/usePluginOverlay';
import { useSession } from '../../lib/useSession';

export default function HomeScreen() {
  const session = useSession();
  const accessToken = session.status === 'signed-in' ? session.session.access_token : null;
  const me = useMe(accessToken);
  const sessionUser = session.status === 'signed-in' ? session.session.user : null;

  const greeting = timeAwareGreeting();
  const firstName = firstNameFromUser(sessionUser);

  const startCall = useCallStore((s) => s.startCall);
  const showOverlay = usePluginOverlay((s) => s.show);

  // Boot RxDB sync on home so the wiki overlay has data ready when opened.
  useRxdbReady();

  async function signOut() {
    await supabase.auth.signOut();
  }

  function openCall() {
    startCall();
    router.push('/call');
  }

  return (
    <View className="flex-1 bg-azure-bg">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-2">
          <Text className="text-xl font-semibold text-azure-text">Audri</Text>
          <Pressable onPress={signOut} className="rounded-full bg-azure-surface p-2 active:opacity-70">
            <Ionicons name="person-outline" size={20} color="#e8f1ff" />
          </Pressable>
        </View>

        <View className="mt-12 px-6">
          <Text className="text-3xl font-medium text-azure-text">
            {greeting}
            {firstName ? `, ${firstName}` : ''}.
          </Text>
          {me.status === 'ready' && (
            <Text className="mt-2 text-sm text-azure-text-muted">
              {me.data.agents.length} agent · {me.data.userSettings?.enabledPlugins.length ?? 0} plugin
              {(me.data.userSettings?.enabledPlugins.length ?? 0) === 1 ? '' : 's'}
            </Text>
          )}
          {me.status === 'error' && (
            <Text className="mt-2 text-xs text-red-400">/me error: {me.error}</Text>
          )}
        </View>

        <View className="mt-10 flex-1 px-6">
          <View className="flex-row gap-3">
            <PluginTile label="Wiki" icon="library-outline" onPress={() => showOverlay('wiki')} />
            <PluginTile label="Todos" icon="checkbox-outline" />
          </View>
          <View className="mt-3 flex-row gap-3">
            <PluginTile label="Research" icon="search-outline" />
            <PluginTile label="Profile" icon="person-circle-outline" />
          </View>
        </View>

        <View className="items-center pb-4">
          <Pressable
            onPress={openCall}
            className="h-16 w-16 items-center justify-center rounded-full bg-azure-accent active:opacity-80"
          >
            <Ionicons name="call-outline" size={28} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

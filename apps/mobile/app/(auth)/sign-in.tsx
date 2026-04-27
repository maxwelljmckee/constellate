import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);
    try {
      const redirectTo = Linking.createURL('/auth-callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('no auth url returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        if (result.type === 'cancel' || result.type === 'dismiss') return;
        throw new Error(`auth flow ended: ${result.type}`);
      }

      const params = parseAuthUrl(result.url);
      if (!params.access_token || !params.refresh_token) {
        throw new Error('callback url missing tokens');
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (setErr) throw setErr;
      // onAuthStateChange in (auth)/_layout will redirect to (app).
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-8 bg-azure-bg px-8">
      <Text className="text-3xl font-semibold text-azure-text">Audri</Text>
      <Text className="text-center text-sm text-azure-text-muted">Sign in to continue.</Text>

      <Pressable
        onPress={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-xl bg-azure-accent px-6 py-4 active:opacity-80"
        style={{ opacity: busy ? 0.5 : 1 }}
      >
        <Text className="text-center text-base font-medium text-white">
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </Text>
      </Pressable>

      {err && <Text className="text-center text-xs text-red-400">{err}</Text>}
    </View>
  );
}

function parseAuthUrl(url: string): Record<string, string> {
  // Supabase returns tokens in the URL fragment: audri://auth-callback#access_token=...&refresh_token=...&...
  const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
  return Object.fromEntries(
    fragment.split('&').map((kv) => {
      const [k, v] = kv.split('=');
      return [k ?? '', decodeURIComponent(v ?? '')];
    }),
  );
}

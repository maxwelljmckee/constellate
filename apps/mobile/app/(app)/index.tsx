import { SHARED_PACKAGE_NAME } from '@audri/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { runRxdbSpike, type SpikeResult } from '../../lib/rxdb-spike';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '<unset>';

export default function HomeScreen() {
  const [spike, setSpike] = useState<SpikeResult | null>(null);

  useEffect(() => {
    runRxdbSpike().then(setSpike);
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-azure-bg px-6">
      <Text className="text-2xl font-semibold text-azure-text">Audri</Text>
      <Text className="text-sm text-azure-text-muted">shared pkg: {SHARED_PACKAGE_NAME}</Text>
      <Text className="text-sm text-azure-text-muted">api: {apiUrl}</Text>
      <Text className="mt-4 text-center text-xs text-azure-accent">
        {spike === null
          ? 'rxdb spike: running…'
          : spike.ok
            ? `rxdb spike: ✓ ${spike.details}`
            : `rxdb spike: ✗ [${spike.stage}] ${spike.error}`}
      </Text>
    </View>
  );
}

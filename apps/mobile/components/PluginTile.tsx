import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

interface Props {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
}

export function PluginTile({ label, icon, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center gap-2 rounded-2xl bg-azure-surface px-4 py-6 active:opacity-70"
    >
      <View className="rounded-full bg-azure-bg p-3">
        <Ionicons name={icon} size={24} color="#7aa3d4" />
      </View>
      <Text className="text-sm font-medium text-azure-text">{label}</Text>
    </Pressable>
  );
}

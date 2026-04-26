import { Redirect } from 'expo-router';

// Root redirect. Auth-aware redirect lands in slice 1.
export default function Root() {
  return <Redirect href="/(app)" />;
}

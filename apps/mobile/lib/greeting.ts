export function timeAwareGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Hi';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Hi';
}

// Pulls a first name from Supabase Auth's user_metadata (populated by Google OAuth).
// Falls back to the email local part if metadata is missing.
export function firstNameFromUser(
  user:
    | { email?: string; user_metadata?: { given_name?: string; full_name?: string; name?: string } }
    | null
    | undefined,
): string {
  const meta = user?.user_metadata;
  if (meta?.given_name) return meta.given_name;
  const full = meta?.full_name ?? meta?.name;
  if (full) return full.split(' ')[0] ?? full;
  if (user?.email) return user.email.split('@')[0] ?? '';
  return '';
}

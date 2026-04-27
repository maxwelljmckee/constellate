// Shape of a Supabase database webhook on auth.users INSERT.
// See: https://supabase.com/docs/guides/database/webhooks
export interface SupabaseSignupWebhookBody {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    email?: string;
    [key: string]: unknown;
  } | null;
  old_record: unknown;
}

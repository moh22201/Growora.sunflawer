import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://jsgysongbsoizndqlsvy.supabase.co",
  "sb_publishable_D3ZgnYLYKRCPzPFAqCtDnQ_2AyUxmKR",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

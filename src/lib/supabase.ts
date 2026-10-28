import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://zapzgdenckgmtwukcgof.supabase.co",
  "sb_publishable_yD-VHNTTV3Bd1oA1YslW2A_5dCxGm_U",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

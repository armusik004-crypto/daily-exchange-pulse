import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ChatDatabase = Database & {
  public: {
    Tables: {
      conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string };
        Insert: { id?: string; user_id: string; title?: string; created_at?: string };
        Update: { title?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; role: string; content: string; image_url: string | null; created_at: string };
        Insert: { conversation_id: string; role: string; content: string; image_url?: string | null };
        Update: { content?: string; image_url?: string | null };
        Relationships: [];
      };
    };
  };
};

// The additive schema is declared locally until Cloud can regenerate its types.
export const chatDb = supabase as SupabaseClient<ChatDatabase>;
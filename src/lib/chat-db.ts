import { supabase } from '@/integrations/supabase/client';

// Chat history tables (conversations, messages) are now part of the
// generated Database types, so the plain client is fully typed.
export const chatDb = supabase;

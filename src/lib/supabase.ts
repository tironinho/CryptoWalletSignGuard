/**
 * Supabase client for SignGuard telemetry (Threat Intel & Market Analytics).
 * Client-side only; uses ANON key. No private keys or seed phrases.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cjnzidctntqzamhwmwkt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbnppZGN0bnRxemFtaHdtd2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzIzNzQsImV4cCI6MjA4NjUwODM3NH0.NyUvGRPY1psOwpJytWG_d3IXwCwPxLtuSG6V1uX13mc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

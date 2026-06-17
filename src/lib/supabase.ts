// Supabase 클라이언트 — 환경변수 없으면 null (점진적 향상).
// 키가 없으면 saved.ts 가 localStorage 로 폴백하므로 배포 앱은 키 없이도 동작한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const hasSupabase: boolean = supabase !== null;

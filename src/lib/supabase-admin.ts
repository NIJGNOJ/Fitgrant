// 서버 전용 Supabase 클라이언트 (service_role).
// service_role 키는 RLS 를 우회하므로 **절대 클라이언트(NEXT_PUBLIC_*)로 노출 금지**.
// 마감 알림 구독 테이블은 anon 정책이 없어(=브라우저 차단) 이 클라이언트로만 읽고 쓴다.
// 키가 없으면 null → 구독/크론 라우트가 graceful no-op 으로 폴백(점진적 향상).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

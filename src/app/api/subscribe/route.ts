// 마감 알림 구독 (서버 전용)
//
// 이메일 1개 → 저장한 관심사업 전체에 대해 D-7/D-3/D-1 알림.
// 구독 정보는 service_role 로만 접근하는 deadline_subscriptions 에 보관(브라우저 직접 접근 차단).
// service_role/Supabase 미설정이면 enabled:false 로 graceful 응답 → UI 가 안내(점진적 향상).
import { supabaseAdmin } from "@/lib/supabase-admin.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  let email = "";
  let programIds: string[] = [];
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
    programIds = Array.isArray(body.programIds)
      ? body.programIds.filter((x: unknown): x is string => typeof x === "string")
      : [];
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  }
  if (programIds.length === 0) {
    return Response.json({ error: "알림 받을 관심 사업이 없습니다." }, { status: 400 });
  }

  // Supabase service_role 미설정 → 발송 인프라 없음. 앱은 정상, 구독만 비활성.
  if (!supabaseAdmin) {
    return Response.json({
      enabled: false,
      message: "이 데모 환경에서는 이메일 발송이 비활성화되어 있어요. (구독·크론 코드는 구현되어 있습니다)",
    });
  }

  const { error } = await supabaseAdmin
    .from("deadline_subscriptions")
    .upsert(
      { email, program_ids: programIds, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    );

  if (error) {
    console.error("[subscribe] upsert 실패:", error.message);
    return Response.json({ error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return Response.json({ enabled: true, count: programIds.length });
}

// 마감 알림 크론 (Vercel Cron 매일 호출)
//
// 흐름: 구독자 조회 → 각자의 관심사업 중 오늘 D-7/3/1 도래분 산출 →
//       이미 보낸 (사업·마일스톤) 제외(멱등) → Resend 발송 → 발송 로그 적재.
// 안전장치:
//   - CRON_SECRET 설정 시 Authorization: Bearer 검사(외부 무단 트리거 차단).
//   - Supabase(service_role) 또는 RESEND_API_KEY 없으면 skip(점진적 향상).
//   - deadline_sent 유니크 제약으로 같은 사업·마일스톤 중복 발송 방지.
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin.ts";
import { programs } from "@/lib/programs.ts";
import { findDueDeadlines, buildDigestEmail, todayKST } from "@/lib/notify.ts";

const DEFAULT_FROM = "FitGrant <onboarding@resend.dev>";

export async function GET(req: Request) {
  // 1) 크론 인증 (CRON_SECRET 설정 시에만 강제)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 2) 인프라 점검
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabaseAdmin || !resendKey) {
    return Response.json({
      skipped: true,
      reason: !supabaseAdmin ? "no supabase service role" : "no resend key",
    });
  }

  // 테스트용 today 오버라이드(?today=YYYY-MM-DD). 미지정 시 실제 KST 날짜.
  const override = new URL(req.url).searchParams.get("today");
  const today = override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : todayKST(new Date());

  const resend = new Resend(resendKey);
  const from = process.env.RESEND_FROM ?? DEFAULT_FROM;

  const { data: subs, error } = await supabaseAdmin
    .from("deadline_subscriptions")
    .select("id,email,program_ids");
  if (error) {
    console.error("[cron] 구독 조회 실패:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sentEmails = 0;
  let sentItems = 0;

  for (const sub of subs ?? []) {
    const hits = findDueDeadlines(programs, (sub.program_ids as string[]) ?? [], today);
    if (hits.length === 0) continue;

    // 멱등: 이미 보낸 (program_id, milestone) 제외
    const { data: already } = await supabaseAdmin
      .from("deadline_sent")
      .select("program_id,milestone")
      .eq("subscription_id", sub.id);
    const seen = new Set((already ?? []).map((a) => `${a.program_id}:${a.milestone}`));
    const fresh = hits.filter((h) => !seen.has(`${h.program.id}:${h.dday}`));
    if (fresh.length === 0) continue;

    const { subject, html, text } = buildDigestEmail(fresh);
    const { error: sendErr } = await resend.emails.send({
      from,
      to: sub.email as string,
      subject,
      html,
      text,
    });
    if (sendErr) {
      console.error("[cron] 발송 실패:", sub.email, sendErr);
      continue;
    }

    await supabaseAdmin.from("deadline_sent").insert(
      fresh.map((h) => ({
        subscription_id: sub.id,
        program_id: h.program.id,
        milestone: h.dday,
        sent_on: today,
      }))
    );
    sentEmails += 1;
    sentItems += fresh.length;
  }

  return Response.json({
    ok: true,
    today,
    subscribers: subs?.length ?? 0,
    sentEmails,
    sentItems,
  });
}

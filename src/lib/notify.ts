// 마감 알림 공통 로직 (구독 API · 크론에서 공유).
// 순수함수로 분리해 키 없이도 단위 검증 가능(scripts/demo-notify.ts).
import type { Program } from "./types.ts";
import { dDay } from "./match.ts";

// 알림 발송 시점(마감까지 남은 일수). D-30 → D-7 → D-3 → D-1 네 번.
export const MILESTONES = [30, 7, 3, 1] as const;

export interface DeadlineHit {
  program: Program;
  dday: number; // 도래한 마일스톤 (7 / 3 / 1)
}

/** 구독자의 관심사업 중 오늘 마일스톤(D-7/3/1)에 해당하는 사업 — 가까운 순 */
export function findDueDeadlines(
  programs: Program[],
  programIds: string[],
  today: string
): DeadlineHit[] {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const hits: DeadlineHit[] = [];
  for (const id of programIds) {
    const p = byId.get(id);
    if (!p) continue;
    const d = dDay(p, today);
    if (d != null && (MILESTONES as readonly number[]).includes(d)) {
      hits.push({ program: p, dday: d });
    }
  }
  return hits.sort((a, b) => a.dday - b.dday);
}

/** 서버(UTC) 기준 현재 시각을 KST 날짜(YYYY-MM-DD)로 변환 — 크론 today 계산용 */
export function todayKST(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const APP_URL = "https://fitgrant.vercel.app";

/** 구독자에게 보낼 마감 임박 다이제스트 이메일 (HTML + 텍스트 폴백) */
export function buildDigestEmail(hits: DeadlineHit[]): {
  subject: string;
  html: string;
  text: string;
} {
  const nearest = hits[0].dday;
  const subject = `[FitGrant] 마감 임박 ${hits.length}건 · 가장 가까운 D-${nearest}`;

  const rows = hits
    .map((h) => {
      const p = h.program;
      const url = p.source_url ?? APP_URL;
      const amount = p.support_amount ? ` · ${escapeHtml(p.support_amount)}` : "";
      return `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#18181b;font-size:15px;">${escapeHtml(p.title)}</div>
          <div style="color:#71717a;font-size:13px;margin-top:2px;">${escapeHtml(p.agency ?? "")}${amount}</div>
          <a href="${url}" style="color:#7c3aed;font-size:13px;text-decoration:none;">공고 보기 →</a>
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #eee;text-align:right;vertical-align:top;white-space:nowrap;">
          <span style="display:inline-block;background:#fef3c7;color:#b45309;font-weight:700;font-size:14px;padding:4px 10px;border-radius:999px;">D-${h.dday}</span>
        </td>
      </tr>`;
    })
    .join("");

  const html = `
  <div style="background:#fafafa;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #eee;">
        <div style="font-weight:800;font-size:18px;color:#18181b;">FitGrant</div>
        <div style="color:#71717a;font-size:14px;margin-top:4px;">저장하신 관심 사업의 <b>마감이 다가오고 있어요.</b></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="padding:16px 24px;color:#a1a1aa;font-size:12px;line-height:1.6;">
        FitGrant 마감 알림 · 데이터 기준으로 안내드리며 실제 일정은 공고 원문을 꼭 확인하세요.<br/>
        <a href="${APP_URL}" style="color:#7c3aed;text-decoration:none;">fitgrant.vercel.app</a>
      </div>
    </div>
  </div>`;

  const text =
    `[FitGrant] 마감 임박 ${hits.length}건\n\n` +
    hits
      .map((h) => `· ${h.program.title} (D-${h.dday}) ${h.program.source_url ?? APP_URL}`)
      .join("\n") +
    `\n\n실제 일정은 공고 원문을 꼭 확인하세요. — fitgrant.vercel.app`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

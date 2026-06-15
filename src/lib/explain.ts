// 적합 사유 / 주의할 자격요건 생성
// 기본: 룰 기반(무료·결정적·환각 없음). 추후 Claude(Haiku) 레이어를 같은 형태로 추가.
import type { MatchResult } from "./types.ts";

export interface Explanation {
  reason: string;          // 왜 적합한가
  caution: string | null;  // 놓치기 쉬운 자격요건 / 주의사항
  source: "rule" | "claude";
}

function won(v: number | null): string {
  if (v == null) return "";
  if (v >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, "")}억원`;
  return `${Math.round(v / 1e4).toLocaleString()}만원`;
}

/** 룰 기반 설명 — 구조화된 매칭 데이터에서 자연스러운 한국어 문장 조립 */
export function explainRuleBased(r: MatchResult): Explanation {
  const p = r.program;
  const e = p.eligibility;

  // ── 적합 사유 ──
  const bits: string[] = [];
  if (p.fashion_specific) bits.push("패션·디자인 브랜드를 직접 대상으로 하고");
  const catMatch = r.matched.find((m) => m.startsWith("관심분야 일치"));
  if (catMatch) bits.push(`관심 분야 '${catMatch.split(": ")[1]}'에 해당하며`);
  if (r.matched.includes("수출 경험 부합")) bits.push("보유한 수출 경험을 살릴 수 있는");

  let reason: string;
  if (bits.length) {
    // 마지막 조각의 어미를 자연스럽게 마무리
    reason = `${bits.join(" ")} 사업입니다.`.replace("하고 사업", "하는 사업").replace("며 사업", "는 사업");
  } else {
    reason = "현재 브랜드 상황에서 신청 자격을 충족하는 사업입니다.";
  }

  const amount = won(p.support_amount_max);
  if (amount) reason += ` 최대 ${amount}까지 지원받을 수 있어요.`;

  const d = r.deadlineDday;
  if (d != null && d >= 0 && d <= 30) reason += ` 마감이 D-${d}로 임박했으니 서둘러 준비하세요.`;
  else if (d != null && d < 0 && p.apply_cycle) reason += " 이번 회차는 지났지만 매년 재공고되는 사업이라 다음 회차를 노릴 수 있어요.";

  // ── 주의할 자격요건 ──
  const reqs: string[] = [];
  if (e.max_years === 0) reqs.push("미창업(예비창업) 단계만 신청 가능");
  else if (e.max_years != null) reqs.push(`업력 ${e.max_years}년 이하`);
  if (e.min_years) reqs.push(`업력 ${e.min_years}년 이상`);
  if (e.export_required) reqs.push("기존 수출실적 필요");
  if (e.region.length && !e.region.includes("전국")) reqs.push(`${e.region.join("·")} 소재 기업 대상`);

  const cautionParts: string[] = [];
  if (reqs.length) cautionParts.push(`주요 자격: ${reqs.join(", ")}.`);
  if (p.verification === "needs_review") cautionParts.push("지원 금액·일정은 과거 공고 기준이라 신청 전 최신 공고로 꼭 재확인하세요.");
  else if (!amount && p.support_amount == null) cautionParts.push("구체적 지원 규모는 공고 원문을 확인하세요.");

  const caution = cautionParts.length ? cautionParts.join(" ") : null;

  return { reason, caution, source: "rule" };
}

/**
 * 적합 사유 생성 진입점. 현재는 룰 기반만. 추후 Claude 연동 시 여기서 분기:
 *   if (useClaude && apiKey) return explainWithClaude(r, apiKey);  // match_explanations 캐시 활용
 */
export function explain(r: MatchResult): Explanation {
  return explainRuleBased(r);
}

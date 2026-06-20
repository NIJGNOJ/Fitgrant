// FitGrant 매칭 엔진 (순수 함수)
// 하드 필터(자격 충족 여부) → 적합도 점수 → 정렬
import type { Program, BrandProfile, MatchResult, FailedRule } from "./types.ts";

const DAY = 86_400_000;

/** 기준일(today, "YYYY-MM-DD") 대비 업력(년). 예비창업/미창업이면 0. */
export function businessYears(p: BrandProfile, today: string): number {
  if (p.biz_type === "예비창업" || p.founded_year == null) return 0;
  const y = Number(today.slice(0, 4));
  return Math.max(0, y - p.founded_year);
}

function isPreFounder(p: BrandProfile): boolean {
  return p.biz_type === "예비창업" || p.founded_year == null;
}

/** 매년/정기 재공고되는 사업인지 (apply_cycle 기준) */
export function isRecurring(program: Program): boolean {
  return !!program.apply_cycle && /연|반기|상시|수시|차수/.test(program.apply_cycle);
}

/** 마감까지 남은 일수. apply_end 없으면 null. 음수면 이미 지남. */
export function dDay(program: Program, today: string): number | null {
  if (!program.apply_end) return null;
  const end = Date.parse(program.apply_end + "T23:59:59");
  const now = Date.parse(today + "T00:00:00");
  return Math.round((end - now) / DAY);
}

/** 하드 필터 — 통과 못 한 규칙 목록 반환 (빈 배열이면 자격 충족) */
export function hardFilter(program: Program, p: BrandProfile, today: string): FailedRule[] {
  const e = program.eligibility;
  const years = businessYears(p, today);
  const failed: FailedRule[] = [];

  // 예비창업 전용 (max_years === 0): 미창업자만
  if (e.max_years === 0 && !isPreFounder(p)) {
    failed.push({ rule: "예비창업전용", detail: `미창업자(예비창업) 대상 — 현재 업력 ${years}년` });
  } else if (e.max_years != null && e.max_years > 0 && years > e.max_years) {
    // 업력 상한
    failed.push({ rule: "업력상한", detail: `업력 ${e.max_years}년 이하 — 현재 ${years}년` });
  }

  // 업력 하한
  if (e.min_years != null && e.min_years > 0 && years < e.min_years) {
    failed.push({ rule: "업력하한", detail: `업력 ${e.min_years}년 이상 — 현재 ${years}년` });
  }

  // 지역 (전국 포함 시 무조건 통과)
  if (e.region.length > 0 && !e.region.includes("전국") && !e.region.includes(p.region)) {
    failed.push({ rule: "지역", detail: `대상 지역 ${e.region.join("·")} — 소재지 ${p.region}` });
  }

  // 사업자 유형 (예비창업은 선정 후 등록 가능 → 개인/법인 허용 사업과 호환으로 간주)
  if (e.biz_type.length > 0 && !e.biz_type.includes(p.biz_type)) {
    const preOk = isPreFounder(p) && (e.biz_type.includes("개인") || e.biz_type.includes("법인"));
    if (!preOk) {
      failed.push({ rule: "사업자유형", detail: `대상 ${e.biz_type.join("·")} — 현재 ${p.biz_type}` });
    }
  }

  // 수출 실적 요구
  if (e.export_required && !p.has_export) {
    failed.push({ rule: "수출실적", detail: "기존 수출실적 필요 — 수출 경험 없음" });
  }

  return failed;
}

/** 적합도 점수(0~100)와 적합 이유 태그 계산. (eligible 사업 대상) */
export function score(program: Program, p: BrandProfile, today: string): { score: number; matched: string[] } {
  const matched: string[] = [];
  let s = 50; // 기본

  // 관심 분야 일치 (category ∩ interests)
  const hits = program.category.filter((c) => p.interests.includes(c));
  if (hits.length) {
    s += Math.min(36, hits.length * 12);
    matched.push(`관심분야 일치: ${hits.join("·")}`);
  }

  // 패션 특화 가점 (도메인 적합 — 이 서비스의 차별점이라 비중을 높게)
  if (program.fashion_specific) {
    s += 14;
    matched.push("패션·디자인 특화 사업");
  }

  // 수출 경험 ↔ 해외수출 사업 시너지 (메인 트랙: 해외진출)
  if (program.category.includes("해외수출") && p.has_export) {
    s += 8;
    matched.push("수출 경험 부합");
  }

  // 마감 임박도 / 재공고 여부 (라벨은 카드 배지가 담당, 여기선 점수만)
  // 적합도(fit)와 시급성은 다른 축 — 시급성은 D-day 배지·임박 배너가 담당하므로 가중을 낮게.
  const d = dDay(program, today);
  if (d != null && d >= 0) {
    if (d <= 30) s += 8;
    else if (d <= 60) s += 4;
  } else if (d == null) {
    if (isRecurring(program)) s += 3;
  } else {
    s += isRecurring(program) ? 2 : -8; // 재공고 사업 소폭 가점, 일회성 마감 감점
  }

  // 신뢰도 가점 (2026 공고로 검증된 confirmed 우대)
  if (program.verification === "confirmed") s += 7;

  // 지원 규모 가점
  if (program.support_amount_max != null) {
    if (program.support_amount_max >= 100_000_000) s += 6;
    else if (program.support_amount_max >= 10_000_000) s += 3;
  }

  return { score: Math.max(0, Math.min(100, s)), matched };
}

/** 단일 사업 매칭 */
export function matchOne(program: Program, p: BrandProfile, today: string): MatchResult {
  const failed = hardFilter(program, p, today);
  const eligible = failed.length === 0;
  const { score: sc, matched } = eligible ? score(program, p, today) : { score: 0, matched: [] };
  return { program, eligible, score: sc, matched, failed, deadlineDday: dDay(program, today) };
}

/** 전체 매칭 — eligible 우선, 점수 내림차순. ineligible은 미충족 적은 순. */
export function matchAll(programs: Program[], p: BrandProfile, today: string): MatchResult[] {
  return programs
    .map((prog) => matchOne(prog, p, today))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (a.eligible) return b.score - a.score;
      return a.failed.length - b.failed.length;
    });
}

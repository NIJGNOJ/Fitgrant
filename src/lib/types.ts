// FitGrant 도메인 타입 (DB programs 테이블 / 매칭 입출력)

export type Verification = "confirmed" | "needs_review";
export type Track = "디자이너" | "기업브랜드";
export type Category =
  | "해외수출" | "국내성장" | "전시박람회" | "디자인개발"
  | "자금" | "창업" | "R&D" | "인력";
export type BizType = "개인" | "법인" | "예비창업";
export type Industry = "제조" | "도소매" | "디자인서비스";

export interface Eligibility {
  min_years: number | null;   // 업력 하한 (이상)
  max_years: number | null;   // 업력 상한 (이하). 0 = 예비창업(미창업)만
  biz_type: string[];         // 허용 사업자 유형
  max_revenue: number | null; // 매출 상한(원)
  export_required: boolean;   // 기존 수출실적 필요 여부
  region: string[];           // 허용 소재지. "전국" 포함 시 전 지역
  industries?: string[];      // 허용 업종. 없거나 빈 배열이면 전업종(무제한)
  small_biz_only?: boolean;   // 소상공인 전용. true면 상시근로자 기준(제조 10인·그외 5인 미만)으로 필터
  notes: string;
}

export interface Program {
  id: string;
  title: string;
  agency: string | null;
  operator: string | null;
  category: string[];
  track: string[];
  summary: string | null;
  support_type: string[];
  support_amount: string | null;
  support_amount_max: number | null;
  apply_start: string | null;
  apply_end: string | null;       // "YYYY-MM-DD"
  apply_cycle: string | null;
  source_url: string | null;
  as_of_date: string;
  verification: Verification;
  fashion_specific: boolean;
  eligibility: Eligibility;
}

// 온보딩에서 입력받는 브랜드 프로필
export interface BrandProfile {
  founded_year: number | null;  // null 또는 biz_type "예비창업" → 미창업
  biz_type: BizType;
  revenue: number | null;       // 연매출(원), 모르면 null
  employees: number | null;
  interests: string[];          // 관심 분야 (Category)
  has_export: boolean;          // 수출 경험 유무
  region: string;               // 소재지 (서울/경기/대구/부산/전국 ...)
  industry: Industry | null;    // 주력 업태 (선택 — 미입력이면 업종 필터 미적용)
}

export interface FailedRule {
  rule: "업력상한" | "업력하한" | "예비창업전용" | "지역" | "사업자유형" | "수출실적" | "업종" | "고용규모";
  detail: string;
}

export interface MatchResult {
  program: Program;
  eligible: boolean;        // 하드 필터 통과 여부
  score: number;            // 0~100 적합도 (eligible일 때만 의미)
  matched: string[];        // 적합 이유 태그
  failed: FailedRule[];     // 미충족 사유
  deadlineDday: number | null; // 마감까지 D-day (음수=마감 지남, null=상시/미정)
}

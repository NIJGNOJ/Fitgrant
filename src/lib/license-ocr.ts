"use client";

// 무료 브라우저 OCR(Tesseract.js) + 룰 기반 파싱.
// ANTHROPIC_API_KEY가 없을 때의 기본 경로 — 키·서버·비용 없이 동작하고,
// 룰 파싱이라 결정적이다(이 프로젝트의 "룰 기본 + AI 옵션" 패턴).
import type { BizType, Industry } from "./types.ts";

export type LicenseExtract = {
  biz_type: BizType | null;
  founded_year: number | null;
  region: string | null;
  uptae: string | null;
  jongmok: string | null;
  industry: Industry | null;
};

const REGIONS = ["서울", "경기", "인천", "대구", "부산", "대전", "광주"];

/** 업태/종목 텍스트 → 주력 업종 추론(룰). 못 맞히면 null. */
export function mapIndustry(uptae?: string | null, jongmok?: string | null): Industry | null {
  const t = `${uptae ?? ""} ${jongmok ?? ""}`;
  if (/제조|봉제|생산|가공/.test(t)) return "제조";
  if (/도매|소매|도소매|판매|유통|커머스/.test(t)) return "도소매";
  if (/디자인|서비스|컨설팅|기획/.test(t)) return "디자인서비스";
  return null;
}

/** OCR 텍스트에서 사업자등록증 항목을 룰로 추출(순수 함수, 테스트 용이). */
export function parseLicenseText(text: string): LicenseExtract {
  // 사업자 유형
  let biz_type: BizType | null = null;
  if (/법인\s*사업자|법인\s*등록\s*번호/.test(text)) biz_type = "법인";
  else if (/개인\s*사업자/.test(text)) biz_type = "개인";

  // 개업연월일 → 연도
  let founded_year: number | null = null;
  const m =
    text.match(/개\s*업\s*(?:연\s*월\s*일|일\s*자)?\s*[:：]?\s*((?:19|20)\d{2})/) ??
    text.match(/((?:19|20)\d{2})\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}/);
  if (m) {
    const y = Number(m[1]);
    if (y >= 1900 && y <= 2100) founded_year = y;
  }

  // 사업장 소재지 → 시/도
  let region: string | null = null;
  for (const r of REGIONS) {
    if (text.includes(r)) {
      region = r;
      break;
    }
  }
  if (!region && /울산|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|세종/.test(text)) {
    region = "기타";
  }

  // 업태 / 종목 (표시용 — 매칭엔 직접 쓰지 않음)
  const clean = (s?: string): string | null => {
    if (!s) return null;
    const v = s.replace(/\s+/g, " ").trim().slice(0, 30);
    return v || null;
  };
  const up = text.match(/업\s*태\s*[:：]?\s*([^\n]+)/);
  const jo = text.match(/종\s*목\s*[:：]?\s*([^\n]+)/);
  const uptae = clean(up?.[1]);
  const jongmok = clean(jo?.[1]);

  return {
    biz_type,
    founded_year,
    region,
    uptae,
    jongmok,
    industry: mapIndustry(uptae, jongmok),
  };
}

/** 등록증 이미지 → Tesseract OCR(한글) → 룰 파싱. 최초 1회 엔진/언어데이터를 내려받는다. */
export async function ocrLicense(file: File): Promise<LicenseExtract> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "kor");
  return parseLicenseText(data.text);
}

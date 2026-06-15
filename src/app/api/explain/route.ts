// Claude 설명 레이어 (선택·서버 전용)
//
// 기본은 룰 기반(무료·결정적·환각0). ANTHROPIC_API_KEY가 있으면 Claude(Haiku)로
// "왜 적합한가" 문장만 더 자연스럽게 **재작성**한다. 핵심 안전장치:
//   - Claude에는 룰 기반 초안 + 구조화된 fact만 전달한다(원천 데이터 직접 노출 X).
//   - 자격요건/주의(caution)는 환각이 치명적이라 **룰 기반 그대로** 통과시킨다.
//   - 키가 없거나 호출이 실패하면 룰 기반으로 폴백한다(점진적 향상).
import Anthropic from "@anthropic-ai/sdk";
import { explainRuleBased, type Explanation } from "@/lib/explain.ts";
import type { MatchResult } from "@/lib/types.ts";

const MODEL = "claude-haiku-4-5";

// 같은 (사업·매칭 신호) 조합은 한 번만 생성하고 재사용한다.
// (Supabase 연결 후에는 match_explanations 테이블로 옮길 자리)
const cache = new Map<string, Explanation>();

function cacheKey(r: MatchResult): string {
  const ddayBucket = r.deadlineDday == null ? "x" : r.deadlineDday < 0 ? "past" : r.deadlineDday <= 30 ? "soon" : "later";
  return `${r.program.id}|${[...r.matched].sort().join(",")}|${ddayBucket}|${r.score}`;
}

function factSheet(r: MatchResult, draft: Explanation): string {
  const p = r.program;
  const lines = [
    `사업명: ${p.title}`,
    `기관: ${p.agency ?? "미상"}`,
    p.fashion_specific ? "패션·디자인 특화 사업: 예" : "범용 사업(패션 특화 아님)",
    r.matched.length ? `매칭된 적합 요소: ${r.matched.join(", ")}` : null,
    p.support_amount_max ? `최대 지원금(원): ${p.support_amount_max}` : null,
    r.deadlineDday != null ? `마감까지(일): ${r.deadlineDday}` : "마감: 상시 또는 미정",
    `룰 기반 초안: ${draft.reason}`,
  ].filter(Boolean);
  return lines.join("\n");
}

const SYSTEM = [
  "너는 패션·디자인 브랜드에게 정부지원사업 적합 사유를 설명하는 한국어 도우미다.",
  "아래 '사실'에 적힌 정보만 사용해 '룰 기반 초안'을 더 자연스럽고 따뜻한 한국어로 다시 써라.",
  "절대 규칙:",
  "- 사실에 없는 자격요건·금액·일정·기관·수치를 새로 만들지 마라(환각 금지).",
  "- 2~3문장, 존댓말, 군더더기 없이. 이모지·마크다운 금지.",
  "- 결과는 다시 쓴 문장만 출력하고 다른 말은 붙이지 마라.",
].join("\n");

export async function POST(req: Request) {
  let result: MatchResult;
  try {
    ({ result } = await req.json());
    if (!result?.program) throw new Error("missing result");
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const rule = explainRuleBased(result);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 키가 없으면 룰 기반 그대로 (앱은 키 없이도 완전 동작)
  if (!apiKey) return Response.json(rule);

  const key = cacheKey(result);
  const cached = cache.get(key);
  if (cached) return Response.json(cached);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: `사실:\n${factSheet(result, rule)}` }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // 재작성 결과가 비면 룰 기반 유지. caution은 항상 룰 기반(결정적) 사용.
    const out: Explanation = text
      ? { reason: text, caution: rule.caution, source: "claude" }
      : rule;
    cache.set(key, out);
    return Response.json(out);
  } catch (err) {
    console.error("[explain] Claude 호출 실패, 룰 기반으로 폴백:", err);
    return Response.json(rule);
  }
}

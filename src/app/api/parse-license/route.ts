// 사업자등록증 자동 추출 (선택·서버 전용)
//
// 등록증 이미지를 Claude Vision(Haiku)으로 읽어 온보딩 폼을 자동 채운다.
// 안전장치:
//   - ANTHROPIC_API_KEY 없으면 503 → 클라이언트가 수동 입력으로 폴백(점진적 향상).
//   - 추출값은 그대로 신뢰하지 않고, 폼에서 사용자가 검토·수정한 뒤 매칭에 쓴다.
//   - 이미지는 파싱에만 쓰고 저장하지 않는다.
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

const PROMPT = `이 이미지는 한국의 사업자등록증입니다. 아래 정보만 JSON으로 추출하세요.
확실하지 않으면 반드시 null. 절대 추측하지 마세요.

{
  "biz_type": "개인" | "법인" | null,        // "개인사업자"→"개인", "법인사업자"→"법인"
  "founded_year": 개업연월일의 연도(숫자 4자리) | null,
  "region": 사업장 소재지의 시/도. 반드시 다음 중 하나로만: "서울","경기","인천","대구","부산","대전","광주","기타" | null,
  "uptae": 업태 문자열 | null,
  "jongmok": 종목 문자열 | null
}

규칙:
- 사업장 소재지가 위 목록에 없는 광역시/도(예: 울산, 강원, 충북)면 "기타".
- JSON 외의 어떤 텍스트도 출력하지 마세요.`;

type Extract = {
  biz_type: "개인" | "법인" | null;
  founded_year: number | null;
  region: string | null;
  uptae: string | null;
  jongmok: string | null;
};

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 503 });

  let image: string | undefined;
  let mediaType: string | undefined;
  try {
    ({ image, mediaType } = await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "no_image" }, { status: 400 });
  if (!ALLOWED_MEDIA.includes(mediaType as AllowedMedia)) {
    return Response.json({ error: "unsupported_type" }, { status: 415 });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as AllowedMedia, data: image },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const raw = msg.content.find((b) => b.type === "text");
    const text = raw && raw.type === "text" ? raw.text : "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as Partial<Extract>;

    // 화이트리스트만 통과 (환각/오염 방지)
    const regions = ["서울", "경기", "인천", "대구", "부산", "대전", "광주", "기타"];
    const out: Extract = {
      biz_type: parsed.biz_type === "개인" || parsed.biz_type === "법인" ? parsed.biz_type : null,
      founded_year:
        typeof parsed.founded_year === "number" &&
        parsed.founded_year >= 1900 &&
        parsed.founded_year <= 2100
          ? parsed.founded_year
          : null,
      region: typeof parsed.region === "string" && regions.includes(parsed.region) ? parsed.region : null,
      uptae: typeof parsed.uptae === "string" ? parsed.uptae.slice(0, 50) : null,
      jongmok: typeof parsed.jongmok === "string" ? parsed.jongmok.slice(0, 50) : null,
    };
    return Response.json(out);
  } catch {
    return Response.json({ error: "parse_failed" }, { status: 500 });
  }
}

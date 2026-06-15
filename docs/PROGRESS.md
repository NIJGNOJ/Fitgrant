# FitGrant 진행 현황 (핸드오프 문서)

> 최종 업데이트: 2026-06-15 · 다음 세션에서 이어서 진행
> 이 문서 하나로 전체 맥락을 파악할 수 있도록 정리했습니다.

---

## 1. 프로젝트 개요

**FitGrant** — 패션·디자인 브랜드를 위한 **정부지원사업 매칭 PWA**.
브랜드 상황(업력·지역·수출경험·관심분야)을 입력하면 적합한 지원사업을 **자격요건까지 짚어서** 추천한다.

- **목적**: 이직 포트폴리오 겸 창업 사이드 프로젝트
- **어필 강점**: **도메인 전문성** (기획자가 정부사업지원 + 해외수출 실무 담당)
  → 데이터 스키마 + 매칭 로직 자체가 해자(moat)
- **메인 트랙**: 해외진출 (+ 디자인/창업/자금/국내판로 트랙까지 확장)
- 상세 기획: [PRD.md](PRD.md)

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| Frontend/Backend | Next.js 16 (App Router) — PRD엔 14였으나 2026 신규라 최신 사용 |
| 스타일 | Tailwind CSS v4 (shadcn/ui는 아직 미도입, 수기 스타일) |
| DB/Auth | Supabase (스키마 작성 완료, **아직 실연결 전** — 현재 seed JSON 번들로 동작) |
| AI | Claude API — ⑤는 룰 기반 기본 + Claude(Haiku) 선택 레이어 |
| 배포 | Vercel (예정) |
| 실행 | Node 26 네이티브 TypeScript (`node x.ts`), dev 포트 3100 |

---

## 3. 지금까지 한 일 (Week 1~2 완료)

### Week 1 — 데이터 큐레이션 ✅
- 패션·디자인 브랜드 대상 지원사업 **65건** 수작업 큐레이션 → [data/programs.seed.json](../data/programs.seed.json)
- 기관별: 산업부 9 · 중기부 7 · 서울시 뷰티패션산업과 5 · KITA 3 · KOCCA 3 · SBA 2 · 경기 2 · KIDP 1 + 디자인/창업/자금/인력 트랙
- 카테고리(8종): 해외수출30 · 국내성장28 · 전시박람회16 · 디자인개발15 · 자금15 · 창업10 · R&D6 · 인력2
- 신뢰도: confirmed 26 / needs_review 39 (대부분 2025 공고 기준 → 운영 전 2026 원문 재확인 필요)
- `fashion_specific` 태깅: 패션특화 21 / 범용 44 (융자·보증 등 범용 사업은 남기되 태그로 구분)
- 사람이 읽는 검토표: [docs/programs-review.md](programs-review.md)

### Week 2 ① — Supabase 스키마 ✅
- [supabase/schema.sql](../supabase/schema.sql) — 테이블 4개 + 인덱스 + RLS
  - `programs` / `brand_profiles` / `saved_programs` / `match_explanations`(Claude 캐시용)
- [supabase/seed.sql](../supabase/seed.sql) — 65건 upsert (SQL 에디터에 바로 실행)
- 적용 가이드: [supabase/README.md](../supabase/README.md)
- sqlglot 파서 검증 통과

### Week 2 ② — 매칭 엔진 ✅
- [src/lib/match.ts](../src/lib/match.ts) — 순수 함수
  - `hardFilter()`: 업력(min/max_years)·지역·수출요건·예비창업 → 미충족 시 **한국어 사유** 반환
  - `score()`: 관심분야·패션특화·수출시너지·마감임박 가중합 (0~100)
  - 마감 지난 일회성 −8 / 재공고 +2 구분
- 타입: [src/lib/types.ts](../src/lib/types.ts), 데모: [scripts/demo-match.ts](../scripts/demo-match.ts)
- 설계 문서: [docs/matching-logic.md](matching-logic.md)

### Week 2 ③④ — 온보딩 폼 + 결과/상세 카드 ✅
- [src/app/page.tsx](../src/app/page.tsx) — 폼 ↔ 결과 흐름
- [src/components/OnboardingForm.tsx](../src/components/OnboardingForm.tsx) — 사업자유형·설립연도·소재지·수출경험·관심분야
- [src/components/ResultCard.tsx](../src/components/ResultCard.tsx) — 점수배지·적합칩·D-day·펼침상세·원문링크
- [src/lib/programs.ts](../src/lib/programs.ts) — seed JSON 번들 + 매칭 연결
- 브라우저 검증 완료(데스크톱+모바일), 콘솔 에러 0, tsc 통과

### Week 2 ⑤ — 적합 사유 생성 (하이브리드) ✅
- [src/lib/explain.ts](../src/lib/explain.ts) — **룰 기반 생성**(무료·결정적·환각0)이 기본
  - "✓ 왜 적합한가요"(녹색) + "⚠ 신청 전 확인하세요"(amber) 블록을 카드 펼침에 표시
  - `explain()` 진입점에서 추후 Claude 분기 예정
- **비용 판단**: Claude Haiku 써도 호출당 ~1.5원(+캐싱)이라 사실상 무료지만, 정부지원사업은 자격요건 환각이 치명적이라 룰 기반을 기본으로 채택. 모델 후보: `claude-haiku-4-5`

---

## 4. 현재 상태: P0 MVP 사실상 완성 🎉

PRD의 P0 4기능 모두 동작:
- ✅ 온보딩 프로필 입력
- ✅ 매칭 엔진 (하드필터 + 적합도)
- ✅ 결과 리스트 + 상세 카드
- ✅ 적합 사유 / 주의 자격요건 생성

**지금 `npm run dev` 후 localhost:3100에서 완전히 동작** (Supabase·API키 없이도 seed JSON으로 작동).

---

## 5. 파일 맵

```
fitgrant/
├── docs/
│   ├── PRD.md                 # 기획 문서 (스키마 v0.2)
│   ├── matching-logic.md      # 매칭 로직 설계
│   ├── programs-review.md     # 65건 검토용 표
│   ├── TODO-user.md           # 사용자가 직접 해야 할 일
│   └── PROGRESS.md            # (이 문서)
├── data/
│   └── programs.seed.json     # 지원사업 65건 (schema v0.3, fashion_specific 포함)
├── supabase/
│   ├── schema.sql · seed.sql · README.md
├── src/
│   ├── app/                   # layout.tsx, page.tsx, globals.css
│   ├── components/            # OnboardingForm.tsx, ResultCard.tsx
│   └── lib/                   # types.ts, match.ts, explain.ts, programs.ts
└── scripts/demo-match.ts      # 매칭 엔진 콘솔 데모
```

---

### Week 3 — 품질 보강 ① shadcn/ui 도입 ✅ (2026-06-15)
- 수기 Tailwind → **shadcn/ui 컴포넌트 시스템** 전환 (CLI 대신 카피인 방식, `.ts` 확장자 컨벤션 유지)
- `components.json` + `src/lib/utils.ts`(cn) + `globals.css` shadcn 토큰화(Tailwind v4 `@theme`, oklch, primary=짙은 zinc / 링·브랜드=violet)
- ui 프리미티브 8종: `src/components/ui/` — button·input·label·card·badge·select·toggle-group·collapsible
- `OnboardingForm`(ToggleGroup·Select·Input·Button), `ResultCard`(Card·Badge·Collapsible + lucide 아이콘), `page.tsx`(Badge·Button·Card) 리팩터
- 추가 의존성: cva·clsx·tailwind-merge·lucide-react·@radix-ui(slot/select/toggle-group/collapsible/label)·tw-animate-css
- 검증: `tsc` 통과, `next build` 통과, 브라우저(폼·결과·펼침상세) 정상, 콘솔 에러 0

### Week 3 — 품질 보강 ② Claude 설명 레이어 ✅ (2026-06-15)
- 룰 기반을 즉시 기본으로 두고 Claude를 **점진적 향상(progressive enhancement)** 레이어로 추가
- [src/app/api/explain/route.ts](../src/app/api/explain/route.ts) — 서버 전용. `ANTHROPIC_API_KEY` 없으면 룰 기반 그대로 반환, 있으면 `claude-haiku-4-5`로 "왜 적합한가요" **재작성만**. 인메모리 캐시(추후 match_explanations 테이블 자리)
- **환각 안전장치**: Claude엔 룰 기반 초안+구조화 fact만 전달, `caution`(자격요건)은 **항상 룰 기반(결정적)** 통과, 호출 실패 시 폴백
- [ResultCard](../src/components/ResultCard.tsx): 룰 즉시 표시 → 펼침 시 `/api/explain` fetch → Claude 도착하면 교체 + "✨ AI 설명" 표시. `explain.ts`는 클라이언트 import라 SDK 미포함(서버 라우트에만)
- 의존성 `@anthropic-ai/sdk`. 환경변수 안내 `.env.local.example`
- 검증: `tsc`+`next build` 통과, 브라우저에서 키 없는 폴백 경로 OK(`POST /api/explain → 200`, `source:"rule"`), 콘솔 에러 0

---

## 6. 다음에 할 일 (Week 3~4, 우선순위순)

1. **배포(Vercel) + 케이스 스터디/README** ← 포트폴리오 핵심 산출물. "문제정의→설계 의사결정→결과" 스토리
2. **Supabase 실연결** — 현재 seed JSON 번들. DB 붙이면 관심사업 저장·알림 가능
3. **마감 알림** (PWA 푸시 or 이메일) — P0 마지막 기능
4. (선택) ~~Claude 설명 레이어~~(완료·키만 넣으면 ON), ~~shadcn/ui 도입~~(완료), **needs_review 39건 2026 원문 보강 — 검토 체크리스트 준비 완료** ([docs/needs-review-checklist.md](needs-review-checklist.md), A.패션특화12/B.대표3/C.범용24). 사용자가 채우면 Claude가 seed 반영·confirmed 승격

---

## 7. 사용자가 직접 해야 할 것 — [TODO-user.md](TODO-user.md)

- Supabase 프로젝트 생성 + SQL 실행 (선택, 지금 안 해도 됨)
- Anthropic API 키 발급 (Claude 설명 레이어 추가 시)
- needs_review 39건 도메인 검토 (전문성이 가장 빛나는 부분)
- (배포 단계) Vercel 계정 + GitHub 연결

---

## 8. 빠른 재시작 방법

```bash
cd /Users/jongjin/fitgrant
npm run dev          # → localhost:3100
npm run match:demo   # 매칭 엔진 콘솔 데모
```
(dev 서버는 launch.json의 "fitgrant" 설정, 포트 3100)

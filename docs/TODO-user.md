# 내가(사용자) 직접 해야 하는 것들

> Claude가 코드·문서·데이터는 만들지만, 계정·키 발급·도메인 판단은 직접 해야 합니다.

## 지금 할 수 있는 것 (선택)
- [ ] **Supabase 프로젝트 생성** → `supabase/schema.sql` 실행 → `supabase/seed.sql` 실행 → Table Editor에서 programs 65행 확인
      ([supabase/README.md](../supabase/README.md) 참고). *지금 안 해도 매칭/화면 설계는 진행 가능.*

## 곧 필요한 것
- [ ] **(RLS 강화) Supabase 익명 인증 켜기** — 대시보드 > Authentication > Providers > **"Anonymous sign-ins" 활성화**. 그러면 브라우저마다 `auth.uid()`가 부여돼 본인 행만 접근(진짜 격리). 그 후 기존 프로젝트는 **`supabase/rls-upgrade.sql` 실행**(신규 프로젝트는 최신 `schema.sql`에 이미 포함). **선택**: 안 켜도 앱은 localStorage로 그대로 동작(익명 인증 실패 시 자동 폴백 — 콘솔에 안내 warn만).
- [ ] **Anthropic API 키 발급** (console.anthropic.com) — Claude 설명 레이어 ON 스위치. **선택**: 안 넣으면 룰 기반 설명으로 완전히 동작하고, 넣으면 "왜 적합한가요"가 Claude(Haiku)로 더 자연스럽게 재작성됨. `.env.local.example`를 `.env.local`로 복사 후 `ANTHROPIC_API_KEY`에 값 넣기.
- [ ] **데이터 도메인 검토** — `needs_review` 39건의 2026 일정·자격을 실제 공고로 확인. **체크리스트 준비됨**: [docs/needs-review-checklist.md](needs-review-checklist.md) (A.패션특화 12 / B.대표 3 / C.범용 24, 공고링크 포함). A 그룹만 먼저 채워도 매칭 품질 ↑. 다 채우면 Claude가 seed에 반영. *사용자 도메인 전문성이 가장 빛나는 부분.*
- [ ] **매칭 가중치 판단** — `docs/matching-logic.md`의 점수 가중치가 합리적인지(예: 패션특화 +10이 적절한지) 도메인 감각으로 피드백.
- [ ] **(마감 알림 이메일) 활성화** — 아래 3개를 모두 채우면 저장한 관심사업의 마감(D-7·D-3·D-1)에 이메일이 자동 발송됨. **선택**: 안 채우면 구독 폼은 "비활성화" 안내만 하고 앱은 정상 동작.
  1. **Supabase 마감 알림 테이블 생성** — 대시보드 > SQL Editor 에서 **`supabase/deadline-notifications.sql` 실행** (신규 프로젝트는 최신 `schema.sql`에 이미 포함).
  2. **Supabase service_role 키** — 대시보드 > Settings > API 의 `service_role` 키를 `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`에 넣기. ⚠️ 절대 깃/클라이언트에 노출 금지(서버 전용).
  3. **Resend API 키** — [resend.com](https://resend.com) 무료 가입(월 3,000건) → API 키를 `.env.local`의 `RESEND_API_KEY`에 넣기. (도메인 인증 전엔 발신주소 `onboarding@resend.dev` 사용)
  - **배포(Vercel)에서 켜려면**: 위 3개 + `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` + 임의의 `CRON_SECRET`을 Vercel > Settings > Environment Variables 에 추가. 크론(`vercel.json`, 매일 09:00 KST)이 자동 발송. *현재 배포는 localStorage 모드라 이 env들이 없으면 발송 안 됨(정상).*

## 나중에 (배포 단계)
- [ ] **Vercel 계정** + GitHub 저장소 연결 (배포)
- [ ] **온보딩 입력 항목 확정** — 매출 구간 코드, 관심분야 선택지 등 실제 폼에 넣을 값 결정
- [ ] (선택) 지인 패션 브랜드 3~5명에게 사용 피드백 받기

## Claude가 대신 못 하는 이유
계정 로그인, 결제수단 등록, API 키 발급, 실제 공고문 진위 최종판단은 권한·책임이 사용자에게 있습니다.

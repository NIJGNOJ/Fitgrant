# FitGrant — Supabase 적용 가이드

## 파일
- `schema.sql` — 테이블 4개(programs / brand_profiles / saved_programs / match_explanations) + 인덱스 + RLS 정책(익명 인증 격리, v0.4)
- `seed.sql` — 지원사업 시드 (자동 생성, `data/programs.seed.json` 기준)
- `rls-upgrade.sql` — 기존 v0.3 프로젝트를 v0.4(익명 인증 RLS)로 올리는 마이그레이션

## 적용 순서
1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. 대시보드 > **SQL Editor** 에서 `schema.sql` 전체 붙여넣고 실행
3. 이어서 `seed.sql` 붙여넣고 실행 (programs 65건 적재)
4. **Table Editor > programs** 에서 65행 확인

## 데이터 갱신 시
`data/programs.seed.json` 을 수정한 뒤 아래로 `seed.sql` 재생성 → 다시 실행 (id 기준 upsert):
```bash
cd fitgrant && python3 scripts/gen_seed_sql.py   # (생성 스크립트는 Week2 정리 시 분리 예정)
```
현재는 대화 중 일회성 스크립트로 생성했으며, 동일 로직이 필요하면 알려주세요.

## RLS (행 단위 보안) — 익명 인증 격리
v0.4부터 `brand_profiles / saved_programs` 는 **익명 인증(`auth.uid()`) 기준 본인 행만** 접근 가능하고,
`match_explanations` 는 서버(service_role) 전용으로 브라우저 접근이 차단됩니다.

1. 대시보드 > **Authentication > Providers > "Anonymous sign-ins" 활성화** (필수 — 안 켜면 클라이언트가 localStorage 로 폴백).
2. **신규 프로젝트**: `schema.sql` 에 이미 포함 → 추가 작업 없음.
   **기존 v0.3 프로젝트**: `rls-upgrade.sql` 실행(멱등). user_id 없는 옛 행은 정리됨.

클라이언트는 `signInAnonymously()` 로 브라우저마다 익명 사용자를 만들고(세션은 localStorage 보존),
인증이 실패하면 자동으로 localStorage 저장으로 폴백합니다(점진적 향상).

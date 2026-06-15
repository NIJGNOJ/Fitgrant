# FitGrant — Supabase 적용 가이드

## 파일
- `schema.sql` — 테이블 4개(programs / brand_profiles / saved_programs / match_explanations) + 인덱스 + RLS 정책
- `seed.sql` — 지원사업 65건 시드 (자동 생성, `data/programs.seed.json` 기준)

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

## RLS 주의
MVP(비로그인)용으로 `brand_profiles / saved_programs / match_explanations` 는 익명 전체 허용입니다.
**운영 전 반드시** `session_id` 또는 `auth.uid()` 기준 정책으로 교체하세요 (schema.sql 하단 TODO 참고).

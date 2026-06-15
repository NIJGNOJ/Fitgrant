-- FitGrant DB 스키마 (Supabase / PostgreSQL)
-- schema_version 0.3
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣어 실행. seed.sql 은 이 파일 실행 후 적재.

-- ─────────────────────────────────────────────
-- 1) programs : 지원사업 (큐레이션 데이터)
-- ─────────────────────────────────────────────
create table if not exists programs (
  id                  text primary key,
  title               text not null,
  agency              text,                 -- 주관기관
  operator            text,                 -- 운영기관 (nullable)
  category            text[] not null default '{}',   -- 해외수출/국내성장/전시박람회/디자인개발/자금/창업/R&D/인력
  track               text[] not null default '{}',   -- 디자이너 / 기업브랜드
  summary             text,
  support_type        text[] not null default '{}',   -- 현금/융자/보증/바우처/전시·쇼/컨설팅 등
  support_amount      text,                 -- 서술형
  support_amount_max  bigint,               -- 현금성 지원 상한(원), 정렬/필터용
  apply_start         date,
  apply_end           date,
  apply_cycle         text,
  source_url          text,
  as_of_date          date,                 -- 데이터 기준일자
  verification        text check (verification in ('confirmed','needs_review')),
  fashion_specific    boolean not null default false, -- true=패션/섬유/디자이너 전용, false=범용
  eligibility         jsonb not null default '{}'::jsonb,
  -- eligibility 예: {min_years, max_years, biz_type[], max_revenue, export_required, region[], notes}
  created_at          timestamptz not null default now()
);

create index if not exists idx_programs_category    on programs using gin (category);
create index if not exists idx_programs_track        on programs using gin (track);
create index if not exists idx_programs_eligibility  on programs using gin (eligibility);
create index if not exists idx_programs_apply_end    on programs (apply_end);
create index if not exists idx_programs_fashion      on programs (fashion_specific);

-- ─────────────────────────────────────────────
-- 2) brand_profiles : 브랜드 프로필 (온보딩 입력, 로그인 없이 세션 기반 허용)
-- ─────────────────────────────────────────────
create table if not exists brand_profiles (
  id            uuid primary key default gen_random_uuid(),
  session_id    text,                       -- 비로그인 세션 식별자
  founded_year  int,                        -- 설립연도 → 업력 계산
  biz_type      text,                       -- 개인 / 법인 / 예비창업
  revenue_range text,                       -- 매출 구간 코드
  employees     int,
  interests     text[] not null default '{}', -- programs.category 와 매칭
  has_export    boolean,                    -- 수출 경험
  region        text,                       -- 소재지 (서울/경기/대구/부산/전국 등)
  created_at    timestamptz not null default now()
);

create index if not exists idx_brand_profiles_session on brand_profiles (session_id);

-- ─────────────────────────────────────────────
-- 3) saved_programs : 관심 사업 저장 / 마감 알림 대상
-- ─────────────────────────────────────────────
create table if not exists saved_programs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references brand_profiles(id) on delete cascade,
  program_id  text not null references programs(id) on delete cascade,
  notify      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (profile_id, program_id)
);

-- ─────────────────────────────────────────────
-- 4) match_explanations : Claude 생성 "적합 사유/주의 자격요건" 캐시
--    동일 (프로필 조건 해시 + 사업) 조합은 재호출 없이 재사용 → API 비용 절감
-- ─────────────────────────────────────────────
create table if not exists match_explanations (
  id           uuid primary key default gen_random_uuid(),
  profile_hash text not null,               -- 매칭에 영향 주는 프로필 필드들의 해시
  program_id   text not null references programs(id) on delete cascade,
  reason       text,                        -- 적합 사유
  caution      text,                        -- 놓치기 쉬운 자격요건
  model        text,
  created_at   timestamptz not null default now(),
  unique (profile_hash, program_id)
);

create index if not exists idx_match_expl_hash on match_explanations (profile_hash);

-- ─────────────────────────────────────────────
-- RLS (Row Level Security)
--   programs : 공개 읽기 전용
--   그 외    : MVP(비로그인)용 익명 허용 정책. 운영 전 반드시 세션/유저 단위로 강화할 것.
-- ─────────────────────────────────────────────
alter table programs           enable row level security;
alter table brand_profiles     enable row level security;
alter table saved_programs     enable row level security;
alter table match_explanations enable row level security;

create policy "programs public read"        on programs           for select using (true);
create policy "profiles anon all (MVP)"     on brand_profiles     for all using (true) with check (true);
create policy "saved anon all (MVP)"        on saved_programs     for all using (true) with check (true);
create policy "match_expl anon all (MVP)"   on match_explanations for all using (true) with check (true);
-- TODO: 운영 전 brand_profiles/saved_programs 를 session_id 또는 auth.uid() 기준 정책으로 교체.

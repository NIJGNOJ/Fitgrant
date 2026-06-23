-- FitGrant DB 스키마 (Supabase / PostgreSQL)
-- schema_version 0.5 — 마감 알림 이메일 구독(deadline_subscriptions/deadline_sent) 추가
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
  user_id       uuid not null default auth.uid(),  -- 익명 인증 사용자(auth.uid). 본인 행만 접근
  session_id    text,                       -- (구) 비로그인 세션 식별자. 익명 인증 도입 후 보조용
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
create index if not exists idx_brand_profiles_user    on brand_profiles (user_id);

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
-- 5) deadline_subscriptions : 마감 알림 이메일 구독 (서버 service_role 전용)
--    이메일 1개 → 관심사업 전체(program_ids) 마감 알림. D-7/3/1 발송.
-- 6) deadline_sent : 발송 멱등 로그 (같은 사업·마일스톤 중복 발송 방지)
-- ─────────────────────────────────────────────
create table if not exists deadline_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  program_ids  text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists deadline_sent (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references deadline_subscriptions(id) on delete cascade,
  program_id      text not null,
  milestone       int not null,                 -- 7 / 3 / 1 (D-day)
  sent_on         date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (subscription_id, program_id, milestone)
);

create index if not exists idx_deadline_sent_sub on deadline_sent (subscription_id);

-- ─────────────────────────────────────────────
-- RLS (Row Level Security) — 익명 인증(auth.uid()) 기준 본인 행 격리
--   programs          : 공개 읽기 전용
--   brand_profiles    : 본인(auth.uid()) 행만 CRUD
--   saved_programs    : 본인 프로필에 속한 행만 CRUD (parent 소유 확인)
--   match_explanations: 서버(service_role) 전용 캐시 — 브라우저(anon/authenticated) 접근 차단
--   ※ 익명 인증을 켜려면: Supabase 대시보드 > Authentication > Providers > "Anonymous sign-ins" 활성화.
--   ※ 클라이언트가 signInAnonymously() 실패 시 localStorage 로 폴백(점진적 향상).
-- ─────────────────────────────────────────────
alter table programs               enable row level security;
alter table brand_profiles         enable row level security;
alter table saved_programs         enable row level security;
alter table match_explanations     enable row level security;
alter table deadline_subscriptions enable row level security;
alter table deadline_sent          enable row level security;
-- deadline_subscriptions/deadline_sent: 정책 없음 = 브라우저 차단, 서버(service_role) 전용.

create policy "programs public read" on programs for select using (true);

-- brand_profiles: 본인 행만
create policy "profiles own select" on brand_profiles for select using (user_id = auth.uid());
create policy "profiles own insert" on brand_profiles for insert with check (user_id = auth.uid());
create policy "profiles own update" on brand_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles own delete" on brand_profiles for delete using (user_id = auth.uid());

-- saved_programs: 본인 소유 프로필의 행만 (parent brand_profiles.user_id 확인)
create policy "saved own select" on saved_programs for select
  using (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));
create policy "saved own insert" on saved_programs for insert
  with check (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));
create policy "saved own delete" on saved_programs for delete
  using (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));

-- match_explanations: 서버(service_role)만 사용하는 캐시 → 브라우저 정책 없음(=차단).
--   service_role 키는 RLS 를 우회하므로 별도 정책 불필요. anon/authenticated 는 접근 불가.

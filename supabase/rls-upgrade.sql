-- FitGrant RLS 강화 마이그레이션 (schema_version 0.3 → 0.4)
-- 기존에 schema.sql(v0.3)로 만든 Supabase 프로젝트에 적용.
-- MVP 익명 전체허용 정책 → 익명 인증(auth.uid()) 기준 본인 행 격리로 교체.
--
-- 실행 전 🙋 대시보드 > Authentication > Providers > "Anonymous sign-ins" 활성화 필요.
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣어 실행 (멱등 — 재실행 안전).

-- 1) brand_profiles.user_id 추가
--    기존 행(익명 인증 도입 전, MVP 테스트 데이터)은 user_id 가 NULL → 소유자 불명이라 정리.
alter table brand_profiles add column if not exists user_id uuid default auth.uid();
delete from brand_profiles where user_id is null;          -- 소유자 없는 옛 행 제거(saved_programs 도 cascade)
alter table brand_profiles alter column user_id set not null;
create index if not exists idx_brand_profiles_user on brand_profiles (user_id);

-- 2) 기존 MVP(익명 전체허용) 정책 제거
drop policy if exists "profiles anon all (MVP)"   on brand_profiles;
drop policy if exists "saved anon all (MVP)"      on saved_programs;
drop policy if exists "match_expl anon all (MVP)" on match_explanations;

-- 3) brand_profiles: 본인(auth.uid()) 행만
drop policy if exists "profiles own select" on brand_profiles;
drop policy if exists "profiles own insert" on brand_profiles;
drop policy if exists "profiles own update" on brand_profiles;
drop policy if exists "profiles own delete" on brand_profiles;
create policy "profiles own select" on brand_profiles for select using (user_id = auth.uid());
create policy "profiles own insert" on brand_profiles for insert with check (user_id = auth.uid());
create policy "profiles own update" on brand_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles own delete" on brand_profiles for delete using (user_id = auth.uid());

-- 4) saved_programs: 본인 소유 프로필에 속한 행만
drop policy if exists "saved own select" on saved_programs;
drop policy if exists "saved own insert" on saved_programs;
drop policy if exists "saved own delete" on saved_programs;
create policy "saved own select" on saved_programs for select
  using (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));
create policy "saved own insert" on saved_programs for insert
  with check (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));
create policy "saved own delete" on saved_programs for delete
  using (exists (select 1 from brand_profiles bp where bp.id = saved_programs.profile_id and bp.user_id = auth.uid()));

-- 5) match_explanations: 서버(service_role) 전용 캐시 → 브라우저 정책 없음(=차단).
--    (MVP 정책 제거만으로 anon/authenticated 접근 차단됨. service_role 은 RLS 우회.)

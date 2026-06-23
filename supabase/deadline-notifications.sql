-- FitGrant 마감 알림 구독 — 마이그레이션 (멱등)
-- 기존 v0.4 DB 에 이메일 마감 알림 테이블을 추가한다. 신규 설치는 schema.sql 에 이미 포함.
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣어 실행.
--
-- 보안: 두 테이블 모두 RLS 활성 + 정책 없음 = 브라우저(anon/authenticated) 접근 차단.
--       서버 라우트가 service_role 키로만 읽고 쓴다(RLS 우회). 이메일 노출 위험 없음.

-- 구독: 이메일 1개 → 관심사업 전체(program_ids) 마감 알림
create table if not exists deadline_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  program_ids  text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 발송 멱등 로그: 같은 (구독·사업·마일스톤) 중복 발송 방지
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

alter table deadline_subscriptions enable row level security;
alter table deadline_sent          enable row level security;
-- 정책을 만들지 않음 → service_role 외 접근 차단.

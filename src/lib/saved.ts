"use client";

// 관심사업 저장 — Supabase 있으면 DB(brand_profiles→saved_programs), 없으면 localStorage.
// 비로그인: 브라우저 localStorage 의 session_id 로 식별 (스키마의 session_id 흐름).
import { useState, useEffect, useCallback } from "react";
import { supabase, hasSupabase } from "./supabase.ts";
import type { BrandProfile } from "./types.ts";

const LS_SAVED = "fitgrant_saved";
const LS_PROFILE = "fitgrant_profile_id";

// 익명 인증: 브라우저마다 auth.uid() 를 부여해 본인 행만 접근(RLS 격리).
// 세션은 supabase-js 가 localStorage 에 보존 → 재방문 시 동일 사용자로 복원.
// "Anonymous sign-ins" 미활성/실패 시 false 반환 → 호출부가 localStorage 폴백(점진적 향상).
let authReady: Promise<boolean> | null = null;
async function ensureAuth(): Promise<boolean> {
  if (!supabase) return false;
  if (!authReady) {
    authReady = (async () => {
      const { data } = await supabase!.auth.getSession();
      if (data.session) return true;
      const { error } = await supabase!.auth.signInAnonymously();
      if (error) {
        console.warn("[saved] 익명 인증 실패, localStorage 폴백:", error.message);
        return false;
      }
      return true;
    })();
  }
  return authReady;
}

function lsGet(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_SAVED) || "[]");
  } catch {
    return [];
  }
}

function lsSet(ids: string[]): void {
  localStorage.setItem(LS_SAVED, JSON.stringify(ids));
}

// 익명 인증 사용자의 brand_profile 을 확보(있으면 재사용, 없으면 생성). profile_id 는 캐시.
// user_id 는 DB 기본값 auth.uid() 로 자동 설정되고, RLS 가 본인 행만 노출한다.
async function ensureProfileId(profile: BrandProfile): Promise<string | null> {
  if (!supabase) return null;
  if (!(await ensureAuth())) return null; // 익명 인증 실패 → 폴백
  const cached = localStorage.getItem(LS_PROFILE);
  if (cached) return cached;

  // RLS 가 본인(auth.uid) 행만 반환하므로 별도 필터 없이 조회.
  const { data: existing } = await supabase
    .from("brand_profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  let id = existing?.id ?? null;
  if (!id) {
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({
        founded_year: profile.founded_year,
        biz_type: profile.biz_type,
        interests: profile.interests,
        has_export: profile.has_export,
        region: profile.region,
        employees: profile.employees,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[saved] brand_profile insert 실패, localStorage 폴백:", error.message);
      return null;
    }
    id = data.id;
  }
  if (id) localStorage.setItem(LS_PROFILE, id);
  return id;
}

export type SavedSource = "supabase" | "local";

export function useSaved(profile: BrandProfile | null) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const source: SavedSource = hasSupabase ? "supabase" : "local";

  useEffect(() => {
    let active = true;
    (async () => {
      if (hasSupabase && profile && supabase) {
        const pid = await ensureProfileId(profile);
        if (pid) {
          const { data } = await supabase
            .from("saved_programs")
            .select("program_id")
            .eq("profile_id", pid);
          if (active && data) {
            setSavedIds(new Set(data.map((d) => d.program_id as string)));
            return;
          }
        }
      }
      if (active) setSavedIds(new Set(lsGet()));
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const toggle = useCallback(
    async (programId: string) => {
      const isSaved = savedIds.has(programId);
      // 낙관적 업데이트
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(programId);
        else next.add(programId);
        return next;
      });

      if (hasSupabase && profile && supabase) {
        const pid = await ensureProfileId(profile);
        if (pid) {
          if (isSaved) {
            await supabase
              .from("saved_programs")
              .delete()
              .eq("profile_id", pid)
              .eq("program_id", programId);
          } else {
            await supabase
              .from("saved_programs")
              .insert({ profile_id: pid, program_id: programId });
          }
          return;
        }
      }
      // localStorage 폴백
      const cur = lsGet();
      lsSet(isSaved ? cur.filter((x) => x !== programId) : [...cur, programId]);
    },
    [savedIds, profile]
  );

  return { savedIds, toggle, source };
}

"use client";

// 관심사업 저장 — Supabase 있으면 DB(brand_profiles→saved_programs), 없으면 localStorage.
// 비로그인: 브라우저 localStorage 의 session_id 로 식별 (스키마의 session_id 흐름).
import { useState, useEffect, useCallback } from "react";
import { supabase, hasSupabase } from "./supabase.ts";
import type { BrandProfile } from "./types.ts";

const LS_SAVED = "fitgrant_saved";
const LS_SESSION = "fitgrant_session";
const LS_PROFILE = "fitgrant_profile_id";

function getSessionId(): string {
  let s = localStorage.getItem(LS_SESSION);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(LS_SESSION, s);
  }
  return s;
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

// session_id 로 brand_profile 을 확보(있으면 재사용, 없으면 생성). profile_id 는 캐시.
async function ensureProfileId(profile: BrandProfile): Promise<string | null> {
  if (!supabase) return null;
  const cached = localStorage.getItem(LS_PROFILE);
  if (cached) return cached;

  const session_id = getSessionId();
  const { data: existing } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("session_id", session_id)
    .limit(1)
    .maybeSingle();

  let id = existing?.id ?? null;
  if (!id) {
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({
        session_id,
        founded_year: profile.founded_year,
        biz_type: profile.biz_type,
        interests: profile.interests,
        has_export: profile.has_export,
        region: profile.region,
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

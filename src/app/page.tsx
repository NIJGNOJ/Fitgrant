"use client";

import { useMemo, useState } from "react";
import { RotateCcw, ChevronDown, ChevronUp, X, Bookmark } from "lucide-react";
import { matchAll } from "@/lib/match.ts";
import { programs, TODAY } from "@/lib/programs.ts";
import { useSaved } from "@/lib/saved.ts";
import type { BrandProfile } from "@/lib/types.ts";
import OnboardingForm from "@/components/OnboardingForm.tsx";
import ResultCard from "@/components/ResultCard.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";

export default function Home() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const { savedIds, toggle } = useSaved(profile);

  const results = useMemo(
    () => (profile ? matchAll(programs, profile, TODAY) : []),
    [profile]
  );
  const eligible = results.filter((r) => r.eligible);
  const blocked = results.filter((r) => !r.eligible);
  const shownEligible = showSavedOnly
    ? eligible.filter((r) => savedIds.has(r.program.id))
    : eligible;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold tracking-tight">FitGrant</span>
          <Badge variant="brand">beta</Badge>
        </div>
        <p className="mt-1.5 text-muted-foreground">
          패션·디자인 브랜드를 위한 정부지원사업 매칭. 내 상황에 맞는 사업을 자격요건까지 짚어드려요.
        </p>
      </header>

      {!profile ? (
        <OnboardingForm onSubmit={setProfile} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              자격 충족 <strong className="text-foreground">{eligible.length}</strong>건
              <span className="text-muted-foreground/70"> / 전체 {results.length}건</span>
            </p>
            <div className="flex items-center gap-1">
              {savedIds.size > 0 && (
                <Button
                  type="button"
                  variant={showSavedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSavedOnly((s) => !s)}
                >
                  <Bookmark className="size-4" />
                  저장 {savedIds.size}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProfile(null);
                  setShowBlocked(false);
                  setShowSavedOnly(false);
                }}
              >
                <RotateCcw className="size-4" />
                다시 입력
              </Button>
            </div>
          </div>

          {shownEligible.map((r) => (
            <ResultCard
              key={r.program.id}
              r={r}
              saved={savedIds.has(r.program.id)}
              onToggleSave={() => toggle(r.program.id)}
            />
          ))}

          {showSavedOnly && shownEligible.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              저장한 사업이 없어요. 카드의 <Bookmark className="inline size-4 align-text-bottom" /> 를
              눌러 관심 사업을 저장해 보세요.
            </Card>
          )}

          {blocked.length > 0 && (
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowBlocked((s) => !s)}
                className="w-full text-muted-foreground"
              >
                {showBlocked ? (
                  <>
                    <ChevronUp className="size-4" /> 자격 미충족 숨기기
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" /> 자격 미충족 {blocked.length}건 보기
                  </>
                )}
              </Button>
              {showBlocked && (
                <div className="mt-1 space-y-2">
                  {blocked.map((r) => (
                    <Card key={r.program.id} className="bg-card/60 p-4 shadow-none">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        {r.program.title}
                      </h4>
                      <ul className="mt-1.5 space-y-1">
                        {r.failed.map((f, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-rose-600">
                            <span className="flex shrink-0 items-center gap-0.5 font-semibold">
                              <X className="size-3" />
                              {f.rule}
                            </span>
                            <span className="text-muted-foreground">{f.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-muted-foreground/70">
        데이터 기준일 {TODAY} · 일부 사업은 최신 공고 확인이 필요합니다.
      </footer>
    </main>
  );
}

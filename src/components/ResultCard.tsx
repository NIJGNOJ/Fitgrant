"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Check, AlertTriangle, Sparkles } from "lucide-react";
import type { MatchResult, Program } from "@/lib/types.ts";
import { isRecurring } from "@/lib/match.ts";
import { explain, type Explanation } from "@/lib/explain.ts";
import { cn } from "@/lib/utils.ts";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";

type BadgeVariant = "info" | "muted" | "danger" | "warning" | "secondary";

function won(v: number | null): string {
  if (v == null) return "";
  if (v >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, "")}억원`;
  return `${Math.round(v / 1e4).toLocaleString()}만원`;
}

function dDayLabel(d: number | null, p: Program): { text: string; variant: BadgeVariant } | null {
  if (d == null) return isRecurring(p) ? { text: "상시·정기 모집", variant: "info" } : null;
  if (d < 0)
    return isRecurring(p)
      ? { text: "다음 회차 예정", variant: "info" }
      : { text: "이번 회차 마감", variant: "muted" };
  if (d <= 14) return { text: `마감 D-${d}`, variant: "danger" };
  if (d <= 60) return { text: `D-${d}`, variant: "warning" };
  return { text: `D-${d}`, variant: "secondary" };
}

export default function ResultCard({ r }: { r: MatchResult }) {
  const [open, setOpen] = useState(false);
  const p = r.program;
  const dd = dDayLabel(r.deadlineDday, p);
  const amount = won(p.support_amount_max);

  // 룰 기반 설명을 즉시 보여주고, 펼치면 Claude 설명 레이어를 받아 교체한다.
  // (키가 없거나 실패하면 서버가 룰 기반을 그대로 돌려주므로 변화 없음 — 점진적 향상)
  const [ex, setEx] = useState<Explanation>(() => explain(r));
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: r }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.reason) setEx(data as Explanation);
      })
      .catch(() => {});
  }, [open, r]);

  return (
    <Card className="overflow-hidden p-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full cursor-pointer p-5 text-left transition-colors hover:bg-accent/50">
          <div className="flex items-start gap-3">
            {/* 점수 */}
            <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-lg font-bold leading-none">{r.score}</span>
              <span className="mt-0.5 text-[10px] opacity-60">적합도</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {p.fashion_specific && <Badge variant="brand">패션특화</Badge>}
                {p.verification === "needs_review" && (
                  <Badge variant="muted" title="최신 공고 확인 필요">
                    확인필요
                  </Badge>
                )}
                {dd && <Badge variant={dd.variant}>{dd.text}</Badge>}
              </div>
              <h3 className="mt-1 font-bold leading-snug">{p.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.agency}
                {amount && <span className="font-medium text-foreground"> · 최대 {amount}</span>}
              </p>
              {r.matched.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {r.matched.map((m, i) => (
                    <Badge key={i} variant="success" className="rounded-md px-2 py-1 text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted-foreground/50 transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 border-t px-5 pt-3 pb-5">
          {/* 적합 사유 / 주의 자격요건 (룰 기반 생성) */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold text-emerald-700">
              <Check className="size-3.5" /> 왜 적합한가요
              {ex.source === "claude" && (
                <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand">
                  <Sparkles className="size-3" /> AI 설명
                </span>
              )}
            </p>
            <p className="text-sm leading-relaxed text-emerald-900">{ex.reason}</p>
          </div>
          {ex.caution && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-bold text-amber-700">
                <AlertTriangle className="size-3.5" /> 신청 전 확인하세요
              </p>
              <p className="text-sm leading-relaxed text-amber-900">{ex.caution}</p>
            </div>
          )}
          {p.summary && <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>}
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">지원내용</dt>
            <dd>{p.support_amount ?? "공고 참조"}</dd>
            <dt className="text-muted-foreground">신청시기</dt>
            <dd>
              {p.apply_start && p.apply_end
                ? `${p.apply_start} ~ ${p.apply_end}`
                : p.apply_cycle ?? "공고 참조"}
            </dd>
            <dt className="text-muted-foreground">지원형태</dt>
            <dd>{p.support_type.join(", ") || "-"}</dd>
            {p.eligibility.notes && (
              <>
                <dt className="text-muted-foreground">유의사항</dt>
                <dd className="text-muted-foreground">{p.eligibility.notes}</dd>
              </>
            )}
          </dl>
          {p.source_url && (
            <a
              href={p.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              공고 원문 보기 <ExternalLink className="size-3.5" />
            </a>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

"use client";

// 마감 알림 구독 카드 — 저장한 관심사업이 1건 이상일 때 노출.
// 이메일 1개 입력 → /api/subscribe 로 관심사업 전체 구독. D-7/D-3/D-1 에 이메일 발송.
// 발송 인프라(서버 키)가 없으면 enabled:false 안내(점진적 향상).
import { useState } from "react";
import { Mail, Check, Loader2, Info } from "lucide-react";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type State = "idle" | "loading" | "ok" | "disabled" | "error";

export default function SubscribeCard({ programIds }: { programIds: string[] }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setState("error");
      setMsg("이메일 형식을 확인해 주세요.");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), programIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMsg(data.error ?? "잠시 후 다시 시도해 주세요.");
        return;
      }
      if (data.enabled === false) {
        setState("disabled");
        setMsg(data.message ?? "데모 환경에서는 발송이 비활성화되어 있어요.");
        return;
      }
      setState("ok");
      setMsg(`관심 사업 ${programIds.length}건의 마감을 D-30·D-7·D-3·D-1에 ${email.trim()} 으로 알려드릴게요.`);
    } catch {
      setState("error");
      setMsg("네트워크 오류예요. 잠시 후 다시 시도해 주세요.");
    }
  }

  if (state === "ok") {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 p-3.5">
        <p className="flex items-start gap-1.5 text-sm font-medium text-emerald-800">
          <Check className="mt-0.5 size-4 shrink-0" /> {msg}
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30 p-3.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Mail className="size-4 text-brand" /> 마감 알림 받기
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        저장한 관심 사업 {programIds.length}건의 마감이 다가오면 (D-30·D-7·D-3·D-1) 이메일로 알려드려요.
      </p>
      <form onSubmit={submit} className="mt-2.5 flex gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          disabled={state === "loading"}
          aria-label="알림 받을 이메일"
        />
        <Button type="submit" disabled={state === "loading"} className="shrink-0">
          {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : "알림 신청"}
        </Button>
      </form>
      {(state === "error" || state === "disabled") && (
        <p
          className={`mt-2 flex items-start gap-1.5 text-xs ${
            state === "disabled" ? "text-muted-foreground" : "text-rose-600"
          }`}
        >
          <Info className="mt-0.5 size-3.5 shrink-0" /> {msg}
        </p>
      )}
    </Card>
  );
}

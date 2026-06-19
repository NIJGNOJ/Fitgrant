"use client";

import { useState, type ChangeEvent } from "react";
import { Search, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { BrandProfile, BizType } from "@/lib/types.ts";
import { CATEGORIES } from "@/lib/programs.ts";
import { cn } from "@/lib/utils.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

const REGIONS = ["서울", "경기", "인천", "대구", "부산", "대전", "광주", "기타"];
const BIZ: { v: BizType; label: string; hint: string }[] = [
  { v: "예비창업", label: "예비창업", hint: "아직 사업자 미등록" },
  { v: "개인", label: "개인사업자", hint: "" },
  { v: "법인", label: "법인", hint: "" },
];

export default function OnboardingForm({ onSubmit }: { onSubmit: (p: BrandProfile) => void }) {
  const [bizType, setBizType] = useState<BizType>("개인");
  const [foundedYear, setFoundedYear] = useState<string>("2023");
  const [region, setRegion] = useState("서울");
  const [hasExport, setHasExport] = useState(false);
  const [interests, setInterests] = useState<string[]>(["해외수출"]);

  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isPre = bizType === "예비창업";

  // 사업자등록증 이미지 → Claude Vision 으로 biz_type/설립연도/소재지 자동 채움.
  // 추출값은 폼에 채워질 뿐, 사용자가 검토·수정한 뒤 제출한다(환각 가드).
  async function onLicense(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsing(true);
    setParseMsg(null);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/parse-license", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mediaType: file.type }),
      });
      if (res.status === 503) {
        setParseMsg({ ok: false, text: "자동 채우기는 AI 키가 설정된 환경에서만 동작해요. 아래에 직접 입력해주세요." });
        return;
      }
      if (!res.ok) {
        setParseMsg({ ok: false, text: "등록증을 읽지 못했어요. 아래에 직접 입력해주세요." });
        return;
      }
      const d = (await res.json()) as {
        biz_type?: BizType | null;
        founded_year?: number | null;
        region?: string | null;
        uptae?: string | null;
        jongmok?: string | null;
      };
      if (d.biz_type) setBizType(d.biz_type);
      if (d.founded_year) setFoundedYear(String(d.founded_year));
      if (d.region) setRegion(d.region);
      const filled = [d.biz_type, d.founded_year, d.region].filter(Boolean).join(" · ");
      const job = [d.uptae, d.jongmok].filter(Boolean).join(" / ");
      setParseMsg(
        filled
          ? { ok: true, text: `자동으로 채웠어요: ${filled}${job ? ` · 업태/종목 ${job}` : ""}. 아래에서 확인·수정하세요.` }
          : { ok: false, text: "등록증에서 읽을 수 있는 항목이 없었어요. 직접 입력해주세요." }
      );
    } catch {
      setParseMsg({ ok: false, text: "처리 중 오류가 났어요. 직접 입력해주세요." });
    } finally {
      setParsing(false);
    }
  }

  function submit() {
    onSubmit({
      biz_type: bizType,
      founded_year: isPre ? null : Number(foundedYear) || null,
      revenue: null,
      employees: null,
      interests,
      has_export: hasExport,
      region,
    });
  }

  return (
    <Card>
      <CardContent className="space-y-7 p-6 sm:p-8">
        {/* 사업자등록증 자동 채우기 (선택) */}
        <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4">
          <div className="flex items-center gap-1.5">
            <Upload className="size-4 text-brand" />
            <span className="text-sm font-semibold text-brand">사업자등록증으로 자동 채우기</span>
            <span className="text-xs font-normal text-muted-foreground">선택</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            등록증 이미지를 올리면 사업자유형·설립연도·소재지를 자동으로 채워요. 이미지는 저장하지 않아요.
          </p>
          <label
            className={cn(
              "mt-2.5 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent",
              parsing && "pointer-events-none opacity-60"
            )}
          >
            {parsing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {parsing ? "읽는 중…" : "이미지 선택"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onLicense}
              disabled={parsing}
            />
          </label>
          {parseMsg && (
            <p
              className={cn(
                "mt-2 flex items-start gap-1.5 text-xs",
                parseMsg.ok ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {parseMsg.ok ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              )}
              {parseMsg.text}
            </p>
          )}
        </div>

        {/* 사업자 유형 */}
        <div className="space-y-2.5">
          <Label>사업자 유형</Label>
          <ToggleGroup
            type="single"
            value={bizType}
            onValueChange={(v) => v && setBizType(v as BizType)}
          >
            {BIZ.map((b) => (
              <ToggleGroupItem key={b.v} value={b.v}>
                {b.label}
                {b.hint && <span className="text-xs opacity-60">· {b.hint}</span>}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* 설립연도 */}
        {!isPre && (
          <div className="space-y-2.5">
            <Label htmlFor="year">설립연도</Label>
            <div className="flex items-center gap-3">
              <Input
                id="year"
                type="number"
                inputMode="numeric"
                min={1990}
                max={2026}
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value)}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">업력 계산에 사용돼요</span>
            </div>
          </div>
        )}

        {/* 소재지 */}
        <div className="space-y-2.5">
          <Label htmlFor="region">소재지</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="region" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 수출 경험 */}
        <div className="space-y-2.5">
          <Label>수출 경험</Label>
          <ToggleGroup
            type="single"
            value={hasExport ? "yes" : "no"}
            onValueChange={(v) => v && setHasExport(v === "yes")}
          >
            <ToggleGroupItem value="no">없음</ToggleGroupItem>
            <ToggleGroupItem value="yes">있음</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* 관심 분야 */}
        <div className="space-y-2.5">
          <Label>
            관심 분야 <span className="font-normal text-muted-foreground">(복수 선택)</span>
          </Label>
          <ToggleGroup type="multiple" value={interests} onValueChange={setInterests}>
            {CATEGORIES.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={interests.length === 0}
          className="w-full"
        >
          <Search className="size-4" />
          맞는 지원사업 찾기
        </Button>
      </CardContent>
    </Card>
  );
}

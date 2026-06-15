"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { BrandProfile, BizType } from "@/lib/types.ts";
import { CATEGORIES } from "@/lib/programs.ts";
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

  const isPre = bizType === "예비창업";

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

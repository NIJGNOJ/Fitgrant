// 매칭 엔진 실데이터 데모 — node scripts/demo-match.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { matchAll } from "../src/lib/match.ts";
import type { Program, BrandProfile } from "../src/lib/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../data/programs.seed.json"), "utf8"));
const programs: Program[] = seed.programs;
const TODAY = "2026-06-13";

const profiles: { label: string; p: BrandProfile }[] = [
  {
    label: "① 예비 디자이너 (미창업, 서울, 창업·디자인 관심, 수출경험 없음)",
    p: { founded_year: null, biz_type: "예비창업", revenue: null, employees: null,
         interests: ["창업", "디자인개발"], has_export: false, region: "서울" },
  },
  {
    label: "② 3년차 디자이너 브랜드 (법인, 서울, 해외수출·전시 관심, 수출경험 있음)",
    p: { founded_year: 2023, biz_type: "법인", revenue: 300_000_000, employees: 4,
         interests: ["해외수출", "전시박람회"], has_export: true, region: "서울" },
  },
  {
    label: "③ 7년차 수출 브랜드 (법인, 경기, 해외수출·자금 관심, 수출경험 있음)",
    p: { founded_year: 2019, biz_type: "법인", revenue: 3_000_000_000, employees: 20,
         interests: ["해외수출", "자금"], has_export: true, region: "경기" },
  },
];

const won = (v: number | null) => v == null ? "-" : v >= 1e8 ? `${(v/1e8).toFixed(1).replace(/\.0$/,"")}억` : `${Math.round(v/1e4).toLocaleString()}만`;

for (const { label, p } of profiles) {
  const results = matchAll(programs, p, TODAY);
  const eligible = results.filter((r) => r.eligible);
  console.log("\n" + "=".repeat(78));
  console.log(label);
  console.log(`  자격 충족 ${eligible.length}건 / 전체 ${results.length}건`);
  console.log("-".repeat(78));
  console.log("  ▶ 적합도 Top 5");
  for (const r of eligible.slice(0, 5)) {
    const dd = r.deadlineDday == null ? "" : r.deadlineDday >= 0 ? ` D-${r.deadlineDday}` : " 마감지남";
    console.log(`   [${String(r.score).padStart(3)}점] ${r.program.title}  (${won(r.program.support_amount_max)})${dd}`);
    console.log(`          ↳ ${r.matched.join(" · ")}`);
  }
  // 미충족 예시 2건 — 하드필터가 작동하는지 확인
  const blocked = results.filter((r) => !r.eligible).slice(-3);
  if (blocked.length) {
    console.log("  ▶ 자격 미충족 예시");
    for (const r of blocked) {
      console.log(`   [제외] ${r.program.title}`);
      console.log(`          ↳ ${r.failed.map((f) => `${f.rule}: ${f.detail}`).join(" / ")}`);
    }
  }
}
console.log();

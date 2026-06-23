// 마감 알림 로직 데모/검증 — node scripts/demo-notify.ts
// 키 없이 findDueDeadlines + 이메일 템플릿을 검증한다(순수함수).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findDueDeadlines, buildDigestEmail, MILESTONES, todayKST } from "../src/lib/notify.ts";
import type { Program } from "../src/lib/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../data/programs.seed.json"), "utf8"));
const programs: Program[] = seed.programs;

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const withDeadline = programs.filter((p) => p.apply_end);
console.log(`마감일 있는 사업 ${withDeadline.length}건 / 전체 ${programs.length}건`);
console.log(`마일스톤: ${MILESTONES.map((m) => `D-${m}`).join(" · ")}`);
console.log(`todayKST(now) = ${todayKST(new Date())}`);

// 1) 검증: 임의 사업을 골라 today 를 D-7/3/1 로 맞추면 정확히 잡히는가
const sample = withDeadline.slice(0, 3);
console.log("\n[1] 마일스톤 정확도 — 각 사업의 마감일 기준 today 를 조정");
// dDay 컨벤션: 마감일을 23:59:59 로 잡아 마감일 당일이 D-1 → D-m 은 마감 (m-1)일 전.
const todayForDday = (apply_end: string, m: number) => addDays(apply_end, -(m - 1));
for (const p of sample) {
  for (const m of MILESTONES) {
    const today = todayForDday(p.apply_end!, m);
    const hits = findDueDeadlines(programs, [p.id], today);
    const ok = hits.length === 1 && hits[0].dday === m;
    console.log(`  ${ok ? "✓" : "✗"} ${p.title.slice(0, 28).padEnd(28)} today=${today} → ${hits.map((h) => `D-${h.dday}`).join(",") || "(없음)"}`);
  }
  // 마일스톤이 아닌 날(D-5)은 안 잡혀야 함
  const off = findDueDeadlines(programs, [p.id], todayForDday(p.apply_end!, 5));
  console.log(`    (D-5 인 날: ${off.length === 0 ? "✓ 알림 없음" : "✗ 잘못 잡힘"})`);
}

// 2) 다이제스트 이메일 — 여러 사업이 동시에 임박한 구독자 시나리오
console.log("\n[2] 다이제스트 이메일 미리보기");
const multi = sample.slice(0, 2);
const today = addDays(multi[0].apply_end!, -2); // 첫 사업이 D-3 가 되는 날 (마감 2일 전)
const ids = multi.map((p) => p.id);
const hits = findDueDeadlines(programs, ids, today);
console.log(`  구독자 관심사업 ${ids.length}건, today=${today} → 발송 대상 ${hits.length}건`);
if (hits.length) {
  const mail = buildDigestEmail(hits);
  console.log(`  제목: ${mail.subject}`);
  console.log("  텍스트 본문:");
  console.log(mail.text.split("\n").map((l) => "    " + l).join("\n"));
  console.log(`  HTML 길이: ${mail.html.length}자 (rows ${hits.length})`);
} else {
  console.log("  (이 today 에는 동시 임박 사업이 없음 — 데이터에 따라 정상)");
}
console.log();

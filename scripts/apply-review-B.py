#!/usr/bin/env python3
"""needs_review B그룹(대표 3건) 웹조사 결과를 seed.json/seed.sql에 반영.
- kotra-overseas-branch-2026: 일정·금액 공식 확인 → confirmed 승격
- export-voucher-2026: 일정·자격 확인, 단계별 금액 보수적 갱신 → needs_review 유지
- brand-k-2025: 2024~26 공고 미확인 → needs_review 유지(주의 주석)
실행: python3 scripts/apply-review-B.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = set()

PATCH = {
    "kotra-overseas-branch-2026": {
        "apply_start": "2026-01-07",
        "apply_end": "2026-01-16",
        "verification": "confirmed",
        "support_amount": "단계별 현지 마케팅 대행. 기업부담금: 진입(OKTA) 6개월 약 100만원, 발전(KOTRA) 150~360만원·중진공 225~375만원, 확장(중진공) 9개월 약 600만원",
        "eligibility": {
            "notes": "중소·중견기업(휴·폐업 제외). KOTRA·중진공·OKTA 통합 운영, 전 업종(패션 포함). 2026 연 복수 차수(1차 1/7~1/16, 4차 3/25~4/10). 수출바우처로 부담금 납부 불가. 단계별 부담금은 2026 공식 사업안내 기준.",
        },
    },
    "export-voucher-2026": {
        "support_amount": "전년 수출실적 단계별 차등 — 내수·초보 ~3,000만원, 유망 ~4,500만원, 성장 ~7,000만원, 강소 ~1억원. 국고보조율 단계·소관(중기부/산업부)별 상이",
        "support_amount_max": 100000000,
        "eligibility": {
            "notes": "중소기업기본법 제2조 중소기업. 일정·자격 2026 확인(1차 2025-12-17~2026-01-09, 연중 추가 차수). 수출실적은 자격이 아니라 지원금액 단계 결정 변수(수출 0원도 내수단계 신청 가능). ⚠️단계별 한도는 출처마다 상이 — 당해 공고 원문(PDF) 재확인 필요. 중기부 소관은 업종 제한 적음(패션 가능), 산업부 소관은 제한 있음.",
        },
    },
    "brand-k-2025": {
        "eligibility": {
            "notes": "국내 중소기업, B2C 소비재(Made in Korea). ⚠️2024~2026 신규 모집 공고 미확인(최신 2023) — 폐지/통합/이관 가능성, 운영기관 직접 확인 필요. 공식 분야(뷰티·푸드·리빙 등)에 패션 명시 없음 — 패션·잡화 적용여부 불확실. 직접 현금 아님(로고 사용권+판로·홍보).",
        },
    },
}


def deep_merge(base, patch):
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v


with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

by_id = {p["id"]: p for p in data["programs"]}
for pid in list(PATCH) + list(REMOVE):
    if pid not in by_id:
        sys.exit(f"ERROR: id not found: {pid}")

for pid, patch in PATCH.items():
    deep_merge(by_id[pid], patch)

data["programs"] = [p for p in data["programs"] if p["id"] not in REMOVE]
data["_meta"]["count"] = len(data["programs"])

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"seed.json: {len(data['programs'])}건 (수정 {len(PATCH)}, 제거 {len(REMOVE)})")


def sql_str(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"

def sql_arr(arr):
    if not arr:
        return "'{}'"
    return "'{" + ",".join('"' + str(x).replace('"', '\\"') + '"' for x in arr) + "}'"

def sql_jsonb(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def build_row(p):
    cols = [
        sql_str(p["id"]), sql_str(p["title"]), sql_str(p["agency"]), sql_str(p["operator"]),
        sql_arr(p["category"]), sql_arr(p["track"]), sql_str(p["summary"]),
        sql_arr(p["support_type"]), sql_str(p["support_amount"]),
        ("null" if p["support_amount_max"] is None else str(p["support_amount_max"])),
        sql_str(p["apply_start"]), sql_str(p["apply_end"]), sql_str(p["apply_cycle"]),
        sql_str(p["source_url"]), sql_str(p["as_of_date"]), sql_str(p["verification"]),
        ("true" if p["fashion_specific"] else "false"), sql_jsonb(p["eligibility"]),
    ]
    return "  (" + ", ".join(cols) + ")"


new_by_id = {p["id"]: p for p in data["programs"]}
with open(SQL_PATH, encoding="utf-8") as f:
    lines = f.read().split("\n")

out = []
for line in lines:
    m = re.match(r"^  \('([^']+)',", line)
    if not m:
        out.append(line)
        continue
    pid = m.group(1)
    if pid in REMOVE:
        continue
    if pid in PATCH:
        trailing = "," if line.rstrip().endswith("),") else ""
        out.append(build_row(new_by_id[pid]) + trailing)
    else:
        out.append(line)

with open(SQL_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(out))

row_count = sum(1 for l in out if re.match(r"^  \('", l))
print(f"seed.sql: 동기화 완료 (행 {row_count}개)")

#!/usr/bin/env python3
"""생애최초 청년 예비창업형 → '모두의 창업 프로젝트'(2026 통합) 갱신.
id는 FK·중복 회피 위해 유지하고 내용만 갱신(confirmed 승격).
실행: python3 scripts/apply-modoo-startup.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = set()
PATCH = {
    "first-time-youth-startup-university-2026": {
        "title": "모두의 창업 프로젝트 (창업 오디션)",
        "agency": "중소벤처기업부",
        "operator": "창업진흥원 / 소상공인시장진흥공단",
        "summary": "기존 '생애최초 청년 예비창업형' 등을 통합한 2026년 신설 창업지원사업. 토너먼트형 '창업 오디션'으로 예비창업자·초기창업기업을 단계별 선발해 사업화자금을 차등 지원한다. 연령·생애최초 요건 없이 전 국민 대상.",
        "apply_start": "2026-03-26",
        "apply_end": "2026-05-15",
        "apply_cycle": "연 1회 (창업 오디션)",
        "support_amount": "단계별 차등 — 일반/기술트랙 진출 200만원→MVP 최대 1,000만원→사업화자금 1억원(우승 5억 투자연계), 로컬트랙 진출 200만원→최대 1억원",
        "support_amount_max": 100000000,
        "verification": "confirmed",
        "eligibility": {
            "max_years": 3,
            "biz_type": ["개인", "법인"],
            "notes": "2026 신설(기존 '생애최초 청년 예비창업형' 등 통합·흡수). 토너먼트형 창업 오디션. 일반/기술트랙=예비창업~창업 3년 이내, 로컬트랙=예비창업 전용. 연령·생애최초 요건 폐지(전 국민 대상). 전 업종(패션 가능)·전국. 단계별 차등 지원. 운영 창업진흥원/소진공. 수정공고 존재 — 신청 전 최신 확인.",
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
print(f"seed.json: {len(data['programs'])}건 (수정 {len(PATCH)})")


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
        out.append(line); continue
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
print(f"seed.sql: 동기화 완료 (행 {sum(1 for l in out if re.match(chr(94)+'  '+chr(92)+chr(40)+chr(39), l))}개)")

#!/usr/bin/env python3
"""소상공인 전용 사업에 eligibility.small_biz_only=true 태깅.
매칭 엔진은 상시근로자 수(제조 10인·그외 5인 미만)로 하드필터(근로자 미입력이면 관대 통과).
실행: python3 scripts/apply-small-biz.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = set()
# 소상공인 자격이 공고상 명확한 사업만 (notes 근거). 예비 소상공인(미창업) 사업은 제외.
SMALL_BIZ = [
    "semas-policy-fund-loan",                       # 소상공인기본법 제2조 소상공인
    "mss-smart-manufacturing-sogongin-2025",        # 봉제·의류 소공인(제조 소상공인)
    "brand-sosangongin-yuksung",                    # 중소기업확인서상 소상공인
    "live-commerce-production-support",             # 전 업종 소상공인
    "local-creator-soldojang-2026",                 # 정상 영업 중 소상공인
    "kipa-small-business-trademark-application-2025",  # 소상공인 확인 사업주
]
PATCH = {pid: {"eligibility": {"small_biz_only": True}} for pid in SMALL_BIZ}


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
print(f"seed.json: 소상공인 태깅 {len(PATCH)}건")


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

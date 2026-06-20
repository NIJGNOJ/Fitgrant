#!/usr/bin/env python3
"""업종 제한이 명확한 사업에 eligibility.industries 태깅.
대부분 사업은 전업종이라 태그 없음(빈/없음=무제한). 명확한 제한만 보수적으로.
실행: python3 scripts/apply-industry-tags.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = set()
PATCH = {
    # 소공인 스마트제조: 제조(봉제·의류) 소공인 대상
    "mss-smart-manufacturing-sogongin-2025": {"eligibility": {"industries": ["제조"]}},
    # 디자인전문기업육성: 산업디자인전문회사 신고기업
    "kidp-design-firm-fostering-globalization-2025": {"eligibility": {"industries": ["디자인서비스"]}},
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
print(f"seed.json: 업종 태깅 {len(PATCH)}건")


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

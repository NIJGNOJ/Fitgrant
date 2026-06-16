#!/usr/bin/env python3
"""needs_review A그룹(패션특화 12건) 웹조사 결과를 seed.json/seed.sql에 반영.
- global-fashion-biz: 2013년 종료 확인 → 제거
- kfashion-global-popup / ddm-kfashion: confirmed 승격(자격·일정 수정 포함)
- 나머지: 일정/자격/주석 갱신, needs_review 유지
실행: python3 scripts/apply-review-A.py
"""
import json, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = {"global-fashion-biz"}

# id -> 부분 수정(딕셔너리 병합). eligibility는 중첩 병합.
PATCH = {
    "kfashion-global-popup-2026": {
        "agency": "서울경제진흥원(SBA)",
        "operator": None,
        "support_amount": "해외 팝업비 기업당 700만원 (자부담 300만원 이상 매칭 필수)",
        "verification": "confirmed",
        "eligibility": {
            "export_required": True,
            "region": ["서울"],
            "notes": "운영주체 서울경제진흥원(SBA). 신청일 기준 서울 소재 사업장. 2시즌 이상 컬렉션 제작 + 국내외 세일즈 경험, 수출실적증명원(최근 해외매출) 제출 필수. 자부담 300만원 이상 매칭. 2026 모집 4/7~4/27(종료), 차년도 재모집 알림 대상.",
        },
    },
    "ddm-kfashion-2026": {
        "apply_start": "2026-02-09",
        "apply_end": "2026-02-27",
        "apply_cycle": "연 1회",
        "verification": "confirmed",
        "eligibility": {
            "notes": "동대문 거점 신진 디자이너 브랜드 약 40개사. 운영 서울패션허브. 2026 디자이너 브랜드 트랙 모집 2/9~2/27(종료). 별도 '동대문 도매상인 브랜드 육성' 트랙(2/9~3/8) 존재.",
        },
    },
    "sfw-2026fw": {
        "eligibility": {
            "notes": "디자이너관/기업브랜드관/트레이드쇼 트랙별 자격 상이. 26 F/W 기업브랜드관 신청 2025-11-03~11-28(행사 2026.2 DDP). 트레이드쇼는 의류·잡화 독립 브랜드 업력 1년 이상 필요. 차기 일정·소재지 요건은 모집공고 확인.",
        },
    },
    "next-k-fashion-awards-2026": {
        "apply_start": "2026-04-13",
        "apply_end": "2026-05-06",
        "eligibility": {
            "max_years": 7,
            "notes": "'K-패션오디션'의 리브랜딩 명칭(THE NEXT K-Fashion Awards). ⚠️기존 confirmed 항목 kfa-k-fashion-audition-2025와 동일/중복 사업일 가능성 — 통합·삭제 여부 도메인 검토 필요. 2026 K-섬유패션 통합공고(4/13~5/6) 트랙. 챌린저 업력 7년 이하. 기업당 금액은 협회 공고 확인.",
        },
    },
    "kfa-all-in-korea-2025": {
        "apply_start": "2026-04-13",
        "apply_end": "2026-05-06",
        "eligibility": {
            "notes": "2026 K-섬유패션 글로벌 브랜드 육성 통합공고(4/13~5/6, 종료)의 한 트랙. K-브랜드·K-소재·K-생산 100% 국내 업체 컨소시엄 필수. 컨소시엄별 금액은 한국패션산업협회 공고 확인.",
        },
    },
    "kfa-global-marketing-2025": {
        "apply_start": "2026-04-13",
        "apply_end": "2026-05-06",
        "eligibility": {
            "notes": "2026 K-섬유패션 글로벌 브랜드 육성 통합공고(4/13~5/6, 종료)의 글로벌 전시/B2B2C 마케팅 트랙. 브랜드별 한도는 한국패션산업협회(02-528-0108) 공고 확인.",
        },
    },
    "daegu-kfashion-biz-festival": {
        "eligibility": {
            "notes": "대구광역시 + 대구경북패션사업협동조합 주관. 2026 운영 확인(연중 릴레이, 5~11월 순차 개최). 지역 디자이너 브랜드 대상. 모집 자격·금액 미공개 — 조합 직접 문의 필요.",
        },
    },
    "gyeonggi-textile-fashion-eco-cert-2025": {
        "operator": "한국섬유소재연구원",
        "eligibility": {
            "notes": "경기도 내 본사 또는 공장 소재 섬유·패션 기업. 운영 한국섬유소재연구원. 친환경 글로벌 인증(OEKO-TEX·GRS·GOTS·bluesign 등) 취득 지원. 2025 접수 4월. 2026 정확 일정·기업당 금액(과거 ~1,500만원 언급)은 공고 본문 확인.",
        },
    },
    "fashion-amazon-2026": {
        "eligibility": {
            "notes": "자격(서울 소재·업력 1년 이상)·금액은 2020~21년 공고 기준. 2021 이후 패션 특화 아마존 입점 공고 미확인 — 2026 운영 지속 불명(폐지/통합 가능성). 매칭 노출 시 주의. (2026 아마존 액셀러레이터는 뷰티·건기식 대상의 별개 사업)",
        },
    },
    "busan-local-industry-fashion-2025": {
        "eligibility": {
            "notes": "부산섬유패션산업연합회 운영(부산 동구·금정구 패션 거점). 2개년 사업으로 2025년(2차년도) 12월 종료. 2026 지속/재공모 여부 불명. 문의 051-744-6321.",
        },
    },
    "kofoti-texworld-nyc-koreapavilion-2025": {
        "eligibility": {
            "notes": "2026 NYC 한국관은 KOFOTI 자체 기획·운영으로 국고지원 대상이 아니었을 가능성(춘계 24개사 참가). '수출컨소시엄/국고지원' 전제 재확인 필요. 국고 70% 지원되는 Texworld Paris(별도 항목)와 혼동 주의.",
        },
    },
}


def deep_merge(base, patch):
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v


# ---- 1) seed.json ----
with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

progs = data["programs"]
by_id = {p["id"]: p for p in progs}

for pid in list(PATCH) + list(REMOVE):
    if pid not in by_id:
        sys.exit(f"ERROR: id not found in seed.json: {pid}")

for pid, patch in PATCH.items():
    deep_merge(by_id[pid], patch)

data["programs"] = [p for p in progs if p["id"] not in REMOVE]
data["_meta"]["count"] = len(data["programs"])

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"seed.json: {len(data['programs'])}건 (제거 {len(REMOVE)}, 수정 {len(PATCH)})")

# ---- 2) seed.sql 행 동기화 ----
def sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"

def sql_arr(arr):
    if not arr:
        return "'{}'"
    inner = ",".join('"' + str(x).replace('"', '\\"') + '"' for x in arr)
    return "'{" + inner + "}'"

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

with open(SQL_PATH, encoding="utf-8") as f:
    sql = f.read()

sql = sql.replace("시드 데이터 (65건)", f"시드 데이터 ({len(data['programs'])}건)")

new_by_id = {p["id"]: p for p in data["programs"]}
lines = sql.split("\n")
out = []
for line in lines:
    m = re.match(r"^  \('([^']+)',", line)
    if not m:
        out.append(line)
        continue
    pid = m.group(1)
    if pid in REMOVE:
        continue  # 행 삭제
    if pid in PATCH:
        trailing = "," if line.rstrip().endswith("),") else ""
        out.append(build_row(new_by_id[pid]) + trailing)
    else:
        out.append(line)

with open(SQL_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(out))

row_count = sum(1 for l in out if re.match(r"^  \('", l))
print(f"seed.sql: 동기화 완료 (행 {row_count}개)")

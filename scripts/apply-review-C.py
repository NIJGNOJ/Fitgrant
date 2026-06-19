#!/usr/bin/env python3
"""needs_review C그룹(범용 24건) 웹조사 결과를 seed.json/seed.sql에 반영.
- confirmed 승격 15건(일정·금액·자격 확인), needs_review 유지 9건(주석 갱신)
실행: python3 scripts/apply-review-C.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data/programs.seed.json")
SQL_PATH = os.path.join(ROOT, "supabase/seed.sql")

REMOVE = set()

PATCH = {
    # ── confirmed 승격 ──
    "tradekorea-kita-online-marketing-2026": {
        "verification": "confirmed",
        "eligibility": {"notes": "KITA 운영 B2B 플랫폼(tradeKorea). 플랫폼 입점·바이어 매칭 무료, 월별 유망 바이어 매칭 등 상시. 부가 마케팅 지원은 사업별 상이."},
    },
    "domestic-to-export-2025": {
        "apply_start": "2026-01-02", "apply_end": "2026-03-31", "verification": "confirmed",
        "eligibility": {"notes": "중소·중견 제조/제조관련서비스/지식기반서비스업. 직수출실적 2025년 1천불 미만(내수)~10만불(초보) 대상이라 무실적도 신청 가능. 수출 전과정 컨설팅·바우처. 산업부 공고 2026-003호, KITA/KOTRA 신청."},
    },
    "export-consortium-2025": {
        "apply_cycle": "2026 전시회별 수시 (2~12월)", "verification": "confirmed",
        "eligibility": {"notes": "중기부 2026 통합공고 포함. 중소기업 해외전시포털 모집. 사전준비·현지파견·사후관리 공통비용 최대 70%. 업종별 협단체 주관(중기중앙회 02-2124-3291)."},
    },
    "global-business-center-gbc-2025": {
        "support_amount": "현지 임차료 1년차 80%·2년차 50% 지원(독립 사무공간+공용회의실, 최대 3년)", "verification": "confirmed",
        "eligibility": {"notes": "중진공(KOSME) 운영, 14개국 22개 도시. 해외진출 희망 중소기업. 상시 모집."},
    },
    "sba-overseas-online-market-2026": {
        "apply_end": "2026-04-08", "verification": "confirmed",
        "support_amount": "9개 글로벌 플랫폼(아마존·틱톡샵·큐텐·라쿠텐·쇼피·샤오홍슈 등) 입점·광고·인플루언서·콘텐츠·라이브커머스 솔루션(현물)",
        "eligibility": {"notes": "서울 소재 자체브랜드 보유 중소기업. 2026 참여기업 840개사 공개모집(~4/8). 업종 제한 명시 없어 패션·잡화 적용 가능."},
    },
    "gbsa-global-ip-star-export-2025": {
        "apply_start": "2026-01-12", "apply_end": "2026-02-19", "verification": "confirmed",
        "support_amount": "연 최대 7,000만원, 3년 최대 2억 1,000만원", "support_amount_max": 70000000,
        "eligibility": {"notes": "경기도 본사(남부/북부 센터 구분) 유망 중소기업, 수출실적 보유 또는 수출예정. 특허·상표·디자인 IP 기반 해외진출. 경기TP 운영."},
    },
    "brand-sosangongin-yuksung": {
        "apply_start": "2026-02-26", "apply_end": "2026-04-02", "apply_cycle": "연 1회", "verification": "confirmed",
        "support_amount": "민간 플랫폼 연계 집중 육성(2026 모집 1,000명)",
        "eligibility": {"notes": "중소기업확인서상 소상공인, 전 업종(패션 소상공인 적용 가능). 2026 명칭 '온라인 브랜드 소상공인 육성사업/TOPS'. 판판대로 접수."},
    },
    "leap-startup-package-2026": {
        "apply_start": "2026-01-23", "apply_end": "2026-02-13", "verification": "confirmed",
        "eligibility": {"notes": "창업 3년 초과~7년 이내(신산업 10년, 패스트트랙 3년 미만 가능). 사업화자금 평균 1.2억·최대 2억."},
    },
    "tips-2026": {
        "verification": "confirmed", "support_amount_max": 500000000,
        "support_amount": "R&D 최대 5억 + 사업화·해외마케팅 2억 (엔젤 1~2억 투자 유치 전제)",
        "eligibility": {"notes": "창업 7년 이내(신산업 등 10년). 운영사 추천 기반 수시. 2026 성장중심 개편. ※기존 'R&D 최대 8억'은 5억으로 정정."},
    },
    "local-creator-soldojang-2026": {
        "verification": "confirmed",
        "eligibility": {"notes": "신청일 현재 정상 영업 중 소상공인. 2026년 舊로컬크리에이터+강한소상공인 통합 '소상공인 도약 지원 사업'. 사업화·BM고도화·마케팅(유형별 상이)."},
    },
    "women-enterprise-development-2026": {
        "verification": "confirmed",
        "eligibility": {"notes": "여성 (예비)창업자 및 여성기업. 세부사업별 자격 상이(글로벌 액셀러레이팅은 업력 7년 미만). 통합공고 형태, 세부사업별 별도 모집."},
    },
    "kosmes-startup-foundation-loan": {
        "verification": "confirmed",
        "eligibility": {"notes": "업력 7년 미만 창업기업(예비창업 포함, 신산업 창업 10년 이내). 혁신창업사업화자금 세부. 연 60억 한도(운전 5억). 2026 정책자금."},
    },
    "kosmes-new-market-loan": {
        "verification": "confirmed",
        "eligibility": {"notes": "성장기 기업(업력 무관). 내수기업수출기업화(수출 10만불 미만)·수출기업글로벌화(10만불 이상) 트랙 구분 — 수출실적이 핵심 변수. 연 60억 한도(운전 5억)."},
    },
    "kodit-credit-guarantee": {
        "verification": "confirmed",
        "support_amount": "보증료율 0.5~3.0%(대기업 최고 3.5%), 동일기업당 보증한도 통상 30억원(신용취약 등 15억 제한)",
        "eligibility": {"notes": "업력 무관. 2026 AI첨단산업 우대보증 등 신설, 일반 보증한도 30억 유지."},
    },
    "durunuri-social-insurance": {
        "verification": "confirmed",
        "support_amount": "월평균보수 270만원 미만 신규가입자(국민연금·고용보험) 보험료 80%, 최대 36개월 (사업주 월 최대 ~10.4만원·근로자 ~9.9만원)",
        "eligibility": {"notes": "10인 미만 사업장. 2026 기준 270만원·80%·36개월 유지."},
    },
    # ── needs_review 유지 (주석 갱신) ──
    "kita-kpremium-global-retail-popup-2026": {
        "eligibility": {"notes": "현대백화점·메디퀘스트 3자 MOU, 일본·대만 등 대형쇼핑몰 약 40개사(패션·뷰티). 2026 참가기업 모집 ~1/7 마감(종료), 팝업 운영 2026.3~12. 업력·지역·수출·금액은 공고 본문 미명시."},
    },
    "kita-overseas-marketing-buyer-matching-2026": {
        "eligibility": {"notes": "단일 사업이 아닌 KITA B2B 해외마케팅·바이어매칭 사업군 총칭(수출상담회·무역사절단 등 개별 공고 다수). 프로그램별 일정·자격·참가비 상이 — kita.net 개별 확인."},
    },
    "ecommerce-export-global-mall-2025": {
        "eligibility": {"notes": "아마존·쇼피 등 글로벌쇼핑몰 입점(패션 적용 가능). 2026 운영 확인, 수행기관 모집 ~2/27. 참여기업 접수일·지원율(%)은 2026 공고 본문 확인 필요."},
    },
    "kidp-design-firm-fostering-globalization-2025": {
        "eligibility": {"notes": "산업디자인전문회사 신고기업 대상 추정(패션 디자인전문기업 신고 시 적용 가능성). 2026 공고 게시(KIDP 2026-20호). 자격·금액·일정 본문 확인 필요."},
    },
    "mss-smart-manufacturing-sogongin-2025": {
        "eligibility": {"notes": "봉제·의류 소공인 적용 가능. 2026 소상공인 지원사업 통합공고의 소공인 특화 자동화 트랙으로 흡수. 세부 접수일·금액은 통합공고 확인."},
    },
    "new-business-startup-academy": {
        "eligibility": {"notes": "예비 소상공인(미창업자). 2026 통합공고 내 존재하나 개별 모집 일정 미확정. 사업화자금 최대 4천만(평균 2천만). 소상공인24 접수."},
    },
    "first-time-youth-startup-university-2026": {
        "eligibility": {"notes": "⚠️2025년 '생애최초 청년 예비창업형(창업중심대학)'은 2026년 신설 '모두의 창업 프로젝트'로 통합·재편(독립 사업 폐지). 만29세↓·평균4700만은 2025 정보. 신규 통합사업 세부요건 미확인 — 통합사업으로 갱신/삭제 여부 도메인 판단 필요."},
    },
    "kosmes-innovation-growth-loan": {
        "eligibility": {"notes": "업력 7년 이상(신성장기반 혁신성장지원자금, 시설 중심). 연 60억 한도(운전 5억). 트랙별 세분은 공고 PDF 확인."},
    },
    "kibo-tech-guarantee": {
        "support_amount": "기업당 일반 기술보증 한도 30억원(보증료 0.5~3.0%, 평균 1.18%). ※'최대 20억'은 첨단기술기업 우대보증 별도 한도",
        "eligibility": {"notes": "업력 무관(창업기업 보증은 7년 이내 별도 상품). 기술평가 기반. 일반 한도 30억(첨단기술 우대보증은 별도)."},
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

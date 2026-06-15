import seed from "../../data/programs.seed.json";
import type { Program } from "./types.ts";

export const programs: Program[] = (seed as { programs: Program[] }).programs;

// 데이터 기준일 (데모용 고정값). 추후 new Date() 기반으로 교체.
export const TODAY: string = (seed as { _meta: { as_of_date: string } })._meta.as_of_date;

export const CATEGORIES = [
  "해외수출", "국내성장", "전시박람회", "디자인개발", "자금", "창업", "R&D", "인력",
] as const;

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitGrant — 패션 브랜드 정부지원사업 매칭",
  description: "내 브랜드 상황에 맞는 정부지원사업을 자격요건까지 짚어 골라드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

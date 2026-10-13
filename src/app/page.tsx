"use client";

import { useT } from "@/i18n/provider";

export default function DashboardPage() {
  const { t } = useT();

  return (
    // 사이드바 · 컨텍스트 바(갱신 · 새로고침 · 언어 · 테마)는 앱 셸(layout)이 둔다.
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-title">{t("대시보드")}</h1>
      </header>
    </div>
  );
}

/** CSV 내려받기 (엑셀에서 한글이 깨지지 않게 BOM 을 붙인다) */
export function downloadCsv(name: string, rows: unknown[][]) {
  const csv =
    "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadBlob(name, new Blob([csv], { type: "text/csv" }));
}

export function downloadJson(name: string, data: unknown) {
  downloadBlob(name, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * 영어 · 베트남어 사전. 화면 영역마다 messages/ 아래 파일 하나씩 두고 여기서 합친다.
 * 각 파일은 { en, vi } 를 내보내고, 키는 화면의 한국어 원문 그대로다.
 */
import common from "@/i18n/messages/common";

type Messages = { en: Record<string, string>; vi: Record<string, string> };

const ALL: Messages[] = [common];

export const DICTIONARY: Record<"en" | "vi", Record<string, string>> = {
  en: Object.assign({}, ...ALL.map((m) => m.en)),
  vi: Object.assign({}, ...ALL.map((m) => m.vi)),
};

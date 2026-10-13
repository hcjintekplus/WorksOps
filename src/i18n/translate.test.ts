import { describe, expect, it } from "vitest";
import { toLang } from "./config";
import { DICTIONARY } from "./dictionary";
import { translate } from "./translate";

describe("translate", () => {
  it("한국어는 원문, 다른 언어는 사전 값", () => {
    expect(translate("ko", "언어")).toBe("언어");
    expect(translate("en", "언어")).toBe("Language");
    expect(translate("vi", "언어")).toBe("Ngôn ngữ");
  });

  it("사전에 없으면 원문 그대로", () => {
    expect(translate("en", "사전에 없는 문구")).toBe("사전에 없는 문구");
  });

  it("{name} 자리를 채운다", () => {
    expect(translate("ko", "담당자 {n}명", { n: 3 })).toBe("담당자 3명");
    expect(translate("en", "없는 키 {a} {b}", { a: 1 })).toBe("없는 키 1 {b}");
  });
});

describe("단수 · 복수", () => {
  it("n 이 1 이면 앞쪽, 아니면 뒤쪽", () => {
    expect(translate("en", "{n}건", { n: 1 })).toBe("1 item");
    expect(translate("en", "{n}건", { n: 5 })).toBe("5 items");
    expect(translate("vi", "{n}건", { n: 1 })).toBe("1 mục");
    expect(translate("ko", "{n}건", { n: 1 })).toBe("1건");
  });
});

describe("toLang", () => {
  it("모르는 값은 한국어", () => {
    expect(toLang("vi")).toBe("vi");
    expect(toLang("fr")).toBe("ko");
    expect(toLang(undefined)).toBe("ko");
  });
});

describe("사전 짝 맞춤", () => {
  // 영어에 있는 키는 베트남어에도 있어야 한다 (한쪽만 빠진 번역을 막는다).
  it("영어 · 베트남어 키가 같다", () => {
    const en = Object.keys(DICTIONARY.en).sort();
    const vi = Object.keys(DICTIONARY.vi).sort();
    expect(en.filter((k) => !vi.includes(k))).toEqual([]);
    expect(vi.filter((k) => !en.includes(k))).toEqual([]);
  });

  // 번역문의 {자리} 는 원문과 같아야 값이 빠지지 않는다.
  it("번역문의 {자리} 이름이 원문과 같다", () => {
    const slots = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(",");
    for (const lang of ["en", "vi"] as const) {
      // 단수 | 복수 두 형태는 각각 원문과 같은 자리를 가져야 한다.
      const broken = Object.entries(DICTIONARY[lang]).filter(([k, v]) =>
        v.split("|").some((form) => slots(k) !== slots(form))
      );
      expect(broken).toEqual([]);
    }
  });
});

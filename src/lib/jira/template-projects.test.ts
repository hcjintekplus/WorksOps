import { describe, expect, it } from "vitest";
import { excludeProjects, isTemplateProject, splitOrderBy } from "@/lib/jira/template-projects";

describe("isTemplateProject", () => {
  it("대소문자 표기가 달라도 잡는다", () => {
    expect(isTemplateProject("[Template] SQA Bug")).toBe(true);
    expect(isTemplateProject("[template]CWM")).toBe(true);
    expect(isTemplateProject("[Template][Sales] CXM Sales")).toBe(true);
  });

  it("실제 과제는 통과시킨다", () => {
    expect(isTemplateProject("[SW] iPIS-500")).toBe(false);
    expect(isTemplateProject("[CXM] Template Design Guide")).toBe(false);
  });
});

describe("splitOrderBy", () => {
  it("정렬절을 떼어낸다", () => {
    expect(splitOrderBy('issuetype = Bug ORDER BY created DESC')).toEqual({
      where: "issuetype = Bug",
      orderBy: "ORDER BY created DESC",
    });
  });

  it("정렬절이 없으면 빈 문자열", () => {
    expect(splitOrderBy("issuetype = Bug")).toEqual({ where: "issuetype = Bug", orderBy: "" });
  });

  it("따옴표 안의 order by 는 정렬절이 아니다", () => {
    const jql = 'summary ~ "order by date" AND issuetype = Bug';
    expect(splitOrderBy(jql)).toEqual({ where: jql, orderBy: "" });
  });
});

describe("excludeProjects", () => {
  it("조건 앞에 제외절을 붙인다", () => {
    expect(excludeProjects("issuetype = Bug", ["TKP", "TTP"])).toBe(
      "project NOT IN (TKP, TTP) AND (issuetype = Bug)"
    );
  });

  it("정렬절은 맨 뒤에 남긴다", () => {
    expect(excludeProjects("issuetype = Bug ORDER BY created DESC", ["TKP"])).toBe(
      "project NOT IN (TKP) AND (issuetype = Bug) ORDER BY created DESC"
    );
  });

  it("조건이 정렬절뿐이면 괄호를 만들지 않는다", () => {
    expect(excludeProjects("ORDER BY created DESC", ["TKP"])).toBe(
      "project NOT IN (TKP) ORDER BY created DESC"
    );
  });

  it("뺄 프로젝트가 없으면 원본 그대로", () => {
    expect(excludeProjects("issuetype = Bug", [])).toBe("issuetype = Bug");
  });
});

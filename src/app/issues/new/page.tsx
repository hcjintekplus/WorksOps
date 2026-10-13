"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateGate } from "@/components/workops/state-gate";
import { Banner, Card, Col, Field, Grid, NativeSelect, PageHeader, Textarea } from "@/components/workops/ui";
import { useWorkops } from "@/hooks/use-workops";
import type { Severity } from "@/lib/workops/types";

const MODULES = ["기기 연결", "FW", "앱", "음성", "전원", "에너지"];
const SC01 = {
  title: "여러 기기 연속 연결 시 허브 재부팅 (FW 1.2.3)",
  description: "최종 검증(D-28)에서 IoT 기기 8대 이상을 30초 이내 연속 연결하면 허브가 재부팅됨. 재현율 5/20. FW 1.2.2에서는 미발생.",
};

/** S-001 이슈 접수 — 등록과 동시에 처리 타이머가 시작되고 분석 화면으로 넘어간다 */
export default function NewIssuePage() {
  return <StateGate>{({ state }) => <IssueForm releases={state.db.releases} defaultRelease={state.settings.globalRelease} />}</StateGate>;
}

function IssueForm({ releases, defaultRelease }: { releases: { id: string; name: string; d_minus: number }[]; defaultRelease: string }) {
  const router = useRouter();
  const { send } = useWorkops();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("Critical");
  const [module, setModule] = useState(MODULES[0]);
  const [release, setRelease] = useState(defaultRelease);
  const [simulate, setSimulate] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  function validate() {
    const next = {
      title: title.trim() ? undefined : "제목을 입력하세요",
      description: description.trim() ? undefined : "증상을 입력하세요",
    };
    setErrors(next);
    return next;
  }

  async function submit() {
    const v = validate();
    if (v.title || v.description) {
      (v.title ? titleRef : descRef).current?.scrollIntoView({ block: "center" });
      (v.title ? titleRef : descRef).current?.focus();
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const { id } = await send<{ id: string }>("/api/workops/issues", {
        title: title.trim(),
        description: description.trim(),
        severity,
        module,
        release_id: release,
        ...(simulate ? { simulate } : {}),
      });
      router.push(`/issues/${id}?step=analyze`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="이슈 접수" description="S-001 · 등록과 동시에 처리 타이머가 시작되고 Analysis·Impact Agent가 실행됩니다." />
      <Grid>
        <Col span={8}>
          <Card title="이슈 정보">
            {submitError && <Banner tone="error">{submitError}</Banner>}
            <div className="grid grid-cols-12 gap-4">
              <Field label="제목" hint="필수 · 100자 이내" error={errors.title} className="col-span-12">
                <Input
                  ref={titleRef}
                  value={title}
                  maxLength={100}
                  aria-invalid={Boolean(errors.title)}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title && setErrors((x) => ({ ...x, title: undefined }))}
                  placeholder="예) 여러 기기 연속 연결 시 허브 재부팅 (FW 1.2.3)"
                />
              </Field>
              <Field label="증상" hint="필수" error={errors.description} className="col-span-12">
                <Textarea
                  ref={descRef}
                  value={description}
                  aria-invalid={Boolean(errors.description)}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => description && setErrors((x) => ({ ...x, description: undefined }))}
                  placeholder="재현 조건, 발생 빈도, 발견 단계"
                />
              </Field>
              <Field label="심각도" hint="필수" className="col-span-12 md:col-span-6">
                <div role="radiogroup" className="flex h-9 items-center gap-4">
                  {(["Critical", "Major", "Minor"] as const).map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-1.5 text-body">
                      <input
                        type="radio"
                        name="severity"
                        className="size-4 accent-primary"
                        checked={severity === s}
                        onChange={() => setSeverity(s)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="모듈" className="col-span-6 md:col-span-3">
                <NativeSelect value={module} onChange={(e) => setModule(e.target.value)}>
                  {MODULES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="릴리스" className="col-span-6 md:col-span-3">
                <NativeSelect value={release} onChange={(e) => setRelease(e.target.value)}>
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} D-{r.d_minus}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="시연 옵션" className="col-span-12 md:col-span-6">
                <NativeSelect value={simulate} onChange={(e) => setSimulate(e.target.value)}>
                  <option value="">기본 (SC-01 근거 충분)</option>
                  <option value="insufficient">변형 V-03: 근거 부족 동작 시연</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/issues")}>
                취소
              </Button>
              <Button onClick={submit} disabled={busy}>
                AI 분석 시작
              </Button>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card title="SC-01 예시 입력">
            <p className="text-caption text-muted-foreground">중간발표 대표 시나리오를 그대로 채웁니다.</p>
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setTitle(SC01.title);
                  setDescription(SC01.description);
                  setSeverity("Critical");
                  setModule("기기 연결");
                  setErrors({});
                }}
              >
                SC-01로 채우기
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">
              제목: {SC01.title}
              <br />
              심각도: Critical · 모듈: 기기 연결 · 릴리스: Hub 2.0 D-28
            </p>
          </Card>
        </Col>
      </Grid>
    </>
  );
}

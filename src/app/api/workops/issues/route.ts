import type { NextRequest } from "next/server";
import { z } from "zod";
import { createIssue } from "@/lib/workops/pipeline";
import { handleWrite } from "@/lib/workops/route-helpers";

const newIssueSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  severity: z.enum(["Critical", "Major", "Minor"]),
  module: z.string().trim().min(1).max(40),
  release_id: z.string().min(1).max(40),
  simulate: z.literal("insufficient").optional(),
});

/** S-001 이슈 접수 → 새 이슈 ID */
export function POST(request: NextRequest) {
  return handleWrite(request, newIssueSchema, async (body, actor) => ({ id: await createIssue(actor, body) }));
}

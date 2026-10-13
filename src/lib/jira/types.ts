import { z } from "zod";

export const jiraUserSchema = z
  .object({
    displayName: z.string().optional(),
    emailAddress: z.string().optional(),
    accountId: z.string().optional(),
  })
  .nullable()
  .optional();

export const jiraStatusSchema = z.object({
  name: z.string(),
  statusCategory: z
    .object({
      key: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

export const jiraChangelogItemSchema = z.object({
  field: z.string(),
  fieldtype: z.string().optional(),
  fromString: z.string().nullable().optional(),
  toString: z.string().nullable().optional(),
});

export const jiraChangelogHistorySchema = z.object({
  id: z.string(),
  created: z.string(),
  author: jiraUserSchema,
  items: z.array(jiraChangelogItemSchema),
});

export const jiraChangelogSchema = z
  .object({
    histories: z.array(jiraChangelogHistorySchema).default([]),
  })
  .optional();

// Atlassian Document Format node - kept loose, we only interpret a subset (doc/table/*).
export type AdfNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export const jiraIssueFieldsSchema = z.object({
  summary: z.string(),
  status: jiraStatusSchema,
  duedate: z.string().nullable().optional(),
  reporter: jiraUserSchema,
  created: z.string(),
  project: z
    .object({
      key: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  description: z.custom<AdfNode>().nullable().optional(),
});

export const jiraIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  fields: jiraIssueFieldsSchema,
  changelog: jiraChangelogSchema,
});

export type JiraIssue = z.infer<typeof jiraIssueSchema>;

export const jiraSearchResponseSchema = z.object({
  issues: z.array(jiraIssueSchema),
  nextPageToken: z.string().optional(),
  isLast: z.boolean().optional(),
});

export const jiraApproximateCountResponseSchema = z.object({
  count: z.number(),
});

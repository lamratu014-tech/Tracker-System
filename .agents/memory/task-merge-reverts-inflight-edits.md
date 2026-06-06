---
name: Task merges can revert in-flight main-branch edits
description: When an isolated task agent's branch merges, shared files you edited on main this session can silently revert to the branch's version.
---

# Task merges silently revert in-flight edits to shared files

When an isolated task agent's branch is approved and the platform merges it,
the merge brings that branch's version of every file it touched. If you
(main agent) edited a **shared** file earlier in the same session that the
branch also carries, your edit can be overwritten — silently, mid-session.

**Why:** the merge is whole-file from the branch's base, not a three-way merge
that preserves your concurrent main-branch edits. High-risk shared files:
`lib/api-spec/openapi.yaml`, generated clients (`lib/api-client-react`,
`lib/api-zod`), and route handlers under `artifacts/api-server/src/routes`.
A passing typecheck right after your edit does **not** protect you — the revert
happens later when the merge lands, and the reverted-to version also compiles.

**Symptom seen:** code review reported my just-made openapi + route edits
"weren't there." `rg` confirmed the route had reverted to the pre-edit version
and openapi line numbers had shifted (branch added unrelated schemas).

**How to apply:** after any `[MERGING]`/`[IMPLEMENTED]` task notification lands
mid-session, re-verify (grep) that your in-flight edits to shared files still
exist before declaring done. Re-apply and re-run codegen/typecheck if reverted.

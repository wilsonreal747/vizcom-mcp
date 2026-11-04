---
name: vizcom-workbench
description: Use when working with Vizcom through its unofficial MCP to render sketches, use ordered reference images, edit masked regions, download results, or organize a shared design board. Also use to diagnose missing Vizcom tools or uncertain generation outcomes.
---

# Vizcom workbench

Help the designer and agent work on the same board. Use the installed MCP tools; this Skill supplies workflow decisions, not a server or credentials. Discover the actual tool schemas before calling them. Names below omit any host namespace.

## Start with the existing session

1. Identify the requested board, source images, intended change and output count from the conversation. Reuse explicit authorization; do not ask again for routine steps already requested.
2. Check that `vizcom_status` and the required tools are actually available. A config file or installed Skill is not proof the host loaded the MCP. If absent, follow the [repository installation instructions](https://github.com/wilsonreal747/vizcom-mcp#download-and-install), reload the host as needed, then inspect its tools again. Do not fabricate calls or success.
3. Check status, then read the target board. `vizcom_list_boards` needs an organization ID and lists only 20 recently viewed boards. Do not infer a complete workspace inventory or invent IDs.
4. Use only the user's authorized session. Windows Edge Default is the historically verified session source; desktop-app login, Mac and cloud hosts are not certified. Never request tokens in chat or put them in logs, repository files or feedback. Diagnose a missing authentication path before attempting paid work.

Operate in the background. Do not activate windows, move the mouse, or fall back to browser clicking. Installation or layout requests alone do not authorize generation. An explicit request to generate does; resolve only missing inputs or material unsupported requirements.

## Choose a workflow

Read [operations and limits](references/operations.md) for parameter semantics, recovery and geometry before the corresponding workflow.

| Task | Path |
| --- | --- |
| Sketch render | `upload_sketch` → `render_sketch` → record promptId → `get_result` → `download_result`; `publish_result` makes the Studio result visible on the board |
| Reference exploration | Read/import references → `create_prompt_node` with ordered sourceDrawingIds → `generate_board` with explicit count/resolution → read outputs → `download_drawing` |
| Local modification | Same-sized source and mask PNG → `edit_region` → record/poll promptId → download/publish; rectangular masks can use `make_region_mask` |
| Organize board | Read → calculate bounds and proposed grouping → create sections/move nodes with current timestamps → read back and `check_layout` |

Preserve user-specified reference order. State each image's role in a short prompt: base vehicle/view/composition versus borrowed feature/style. When the user requests base-last, put it last; never silently swap the roles. Use the requested count (batch supports 1–4 per call). Do not adopt a universal three-image default or split larger requests without considering total authorized generation.

The current tools do not expose an independent Original/aspectRatio control. `source` is a resolution tier, and placeholder width/height are not guaranteed generation aspect controls. If exact Original is essential, explain this missing control and resolve that requirement before paid submission. Do not quietly substitute it.

## Handle failure and shared edits

- Preserve returned drawing, prompt and output IDs and local receipt/journal paths. Poll a known job instead of submitting it again.
- A timeout without a promptId is an unknown submission outcome, not permission to retry. Read available receipts and board state. Studio jobs cannot reliably be recovered from drawingId using the current public tools; if unresolved, report the uncertainty and possible duplicate credit cost before any new submission.
- Re-read before edits and use current `expectedUpdatedAt`. On a stale-write error, recompute from the new board; never defeat the check. These checks are not atomic collaborative locks.
- A section does not automatically move or contain its nodes. Verify actual bounds, padding and separation. Preserve existing content and links; move only the requested scope.
- Generation success is not design approval. Report what changed, where to find it, and any visual/technical limits. Do not claim screenshot verification from coordinate checks.

## Keep the handoff small

Return links/IDs for the target board and local outputs, the count submitted/completed/unknown, and any remaining blocker. Keep credentials and company artwork out of public feedback. Suggest a sanitized issue with expected versus actual behavior and reproduction steps; do not submit it or upload assets without authorization.

Source and maintenance: [vizcom-mcp](https://github.com/wilsonreal747/vizcom-mcp). Keep this whole Skill folder together. On updates, compare the installed version with the chosen repository commit and preserve local customizations. Follow [maintenance checks](https://github.com/wilsonreal747/vizcom-mcp/blob/main/docs/SKILL-MAINTENANCE.md). MIT covers this code, not permission to use the upstream service; this is unofficial and subject to upstream terms and compatibility changes.

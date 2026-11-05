# Vizcom MCP (unofficial)

[English](README.md) | [简体中文](README.zh-CN.md)

**Bring AI agents into your Vizcom design workflow: render sketches, generate reference-based variations, edit selected regions, and organize a shared board—without taking over your mouse.**

Built by [Wilson](https://github.com/wilsonreal747) from a designer's everyday workflow. A local stdio MCP adapter over authenticated web-client operations. **Early preview, not a complete Vizcom API.** Not affiliated with or endorsed by Vizcom. Your own authorized account is required; generation consumes Vizcom credits and upstream interface changes may break compatibility.

[Capabilities & evidence](docs/CAPABILITIES.md) · [Roadmap](docs/ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

## New in 0.2.0

Asset image/folder discovery across workbench, personal, team and organization libraries; asset search/read; save a drawing preview as a version-labelled snapshot; reuse its hosted image on a board without uploading it again. Notes, section titles/colors and ordered prompt references are now editable. `read_board` includes original drawing dimensions and resize ratios. **31 tools, 20 offline tests**; the new nonbillable workflow was verified on an isolated synthetic board on 2026-11-05. See [asset and exploration workflow](docs/ASSET-WORKFLOW.md). This does not add native asset history, full-resolution export, 3D or video.

## What you can do

| Workflow | Outcome |
| --- | --- |
| Sketch to image | Upload a sketch, submit a render, poll the same job and download the result |
| Multi-reference exploration | Connect ordered images to an editable native prompt node; generate 1–4 candidates |
| Local changes | Submit a masked edit and optionally restore every outside-mask pixel on publication |
| Shared-board organization | Move/resize nodes, create sections, check containment and restore recorded layouts |

Native prompt nodes and generated images are visible on the same Vizcom board that the designer uses. Studio results need an explicit publish step. This is shared-board editing, not a real-time collaboration protocol or an atomic edit lock.

**Evidence:** historical live upload/render/download, a two-reference/two-output batch, masked edit/publication, and layout recovery on one Windows setup. Twenty offline tests cover selected contracts; they do not establish full feature coverage. No public end-to-end demo or multi-device certification yet. See the capability matrix before relying on a workflow.

## Download and install

**Companion Skill:** [vizcom-workbench](skills/vizcom-workbench/SKILL.md) teaches agents reference handling, layout checks and failure recovery. Copy the whole `skills/vizcom-workbench` folder into your host's supported Skill location; load it separately from the MCP below. See [installation and maintenance checks](docs/SKILL-MAINTENANCE.md). Use current source: the historical v0.1.0 tag does not include this Skill.

Download a tagged source ZIP from this repository or clone it. Requires Node.js 24 and pnpm.

```sh
git clone https://github.com/wilsonreal747/vizcom-mcp.git
cd vizcom-mcp
pnpm install --frozen-lockfile --ignore-scripts
node --test
```

The initial release is `v0.1.0`; 21 tools and 14 offline tests. Runtime implementation matches the locally tested adapter. Authentication via Windows Edge Default profile was verified on the original installation; other machines and cloud agents require their own acceptance checks. No paid generation is run by the test suite.

## Authentication and MCP configuration

Use only your own authorized session. On Windows, normally log in to Vizcom in Edge's Default profile, then explicitly opt into read-only session reuse using `VIZCOM_SESSION_SOURCE=edge`. The adapter reads only exact Vizcom access-token entries from local LevelDB files; it never launches a browser, changes a profile, logs the token or writes it to disk. Restart the server after renewing an expired session. The optional `desktop` source is not live-verified.

Alternatively inject `VIZCOM_ACCESS_TOKEN` into the server process using your own secret manager. Never commit a token or include one in a shared MCP configuration. Leave `VIZCOM_SESSION_SOURCE` unset for token-based use.

Example MCP client configuration (replace paths with your own absolute paths):

```json
{
  "mcpServers": {
    "vizcom": {
      "command": "node",
      "args": ["--use-system-ca", "C:/tools/vizcom-mcp/src/server.mjs"],
      "env": {
        "VIZCOM_SESSION_SOURCE": "edge",
        "VIZCOM_INPUT_ROOT": "C:/design/inputs",
        "VIZCOM_OUTPUT_ROOT": "C:/design/outputs"
      }
    }
  }
}
```

Optionally set `VIZCOM_ORGANIZATION_ID` to your actual workspace ID. First verify `tools/list`, then `vizcom_status`, `vizcom_list_boards` and `vizcom_read_board`. Installing configuration does not prove a running agent loaded it. Cloud agents cannot access your local Edge profile or a local stdio process merely by downloading this repository; they need a compatible execution host and separately authorized authentication. Do not expose this server over an unauthenticated network bridge.

## Workflows

- Sketch: `vizcom_upload_sketch` → `vizcom_render_sketch` → save promptId → poll `vizcom_get_result` → `vizcom_download_result`. `vizcom_render_pipeline` combines upload and submission. Use `vizcom_publish_result` to make a Studio result visible on the shared board.
- References: `vizcom_create_prompt_node` with ordered sourceDrawingIds → `vizcom_generate_board` (1–4 outputs, explicit 2k) → save outputIds → poll `vizcom_read_board` → `vizcom_download_drawing`. The native prompt and output nodes are visible in Vizcom.
- Local edit: `vizcom_make_region_mask` → `vizcom_edit_region` → poll/download the same prompt → publish. White selects, black protects; source and mask dimensions must match. Publication can restore all outside-mask pixels; inspect boundary seams before accepting a design.
- Layout: read current nodes and updatedAt → `vizcom_arrange_nodes` → retain recovery journal → `vizcom_check_layout`. Restore with `vizcom_restore_layout` only when no newer edits conflict.

All x/y positions are centers, with positive Y pointing UP. Drawing display size uses workbenchSizeRatio. Creating a section does not automatically move nodes inside. Leave title margins and check containment and overlap after changes. API geometry checks do not replace visual review.

Never blindly retry a mutation after timeout: preserve returned IDs and reconcile the same task to avoid duplicate credit usage. Timestamp checks are best effort, not atomic locks. Preserve original artwork, prompts and reference links. Generated images are candidates, not automatic design approval.

Additional tools include `vizcom_create_workbench`, `vizcom_create_section`, `vizcom_import_image` (PNG/JPEG/WebP), and `vizcom_update_prompt_node`. Input/output roots are enforced. Downloads are restricted to Vizcom hosts, reject redirects and never forward authentication to image URLs.

## Scope and provenance

This repository contains adapter source, tests, a dependency lock, a synthetic sketch and the minimal persisted-operation identifiers/schema needed for compatibility. No vendor frontend bundles, model weights, database dump, account credentials, private board IDs or customer artwork are distributed. The API is unofficial; this is not a reconstruction of Vizcom's database or models. Third-party service names and API identifiers remain their owners' property.

Video, 3D, model training and full layered export are unsupported. Drawing previews do not guarantee full-resolution or layered originals. `package.json` is private to prevent accidental npm publication; no npm package or one-click installer is provided.

## License and feedback

The adapter code is [MIT licensed](LICENSE). Dependencies retain their own licenses; this license grants no rights to Vizcom services, trademarks, models or user artwork. The original v0.1.0 tag predates the license addition; use the current main branch for the licensed documentation baseline.

Useful feedback includes your OS/Node/client versions, sanitized reproduction steps, expected/actual behavior, and whether credits may already have been spent. Never post tokens, browser profiles, private board IDs or customer artwork. Start with the [contribution guide](CONTRIBUTING.md).

# Vizcom MCP (unofficial)

A local stdio MCP adapter for sketch rendering and collaborative Vizcom boards. It uses authenticated web-client operations, without moving your mouse or controlling browser windows. This project is not affiliated with or endorsed by Vizcom. An authorized Vizcom account is required; generation consumes your account credits. Upstream interface changes may break compatibility.

## Download and install

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

Video, 3D, model training and full layered export are unsupported. Drawing previews do not guarantee full-resolution or layered originals. `package.json` is private to prevent accidental npm publication; this does not prevent GitHub source distribution. No open-source license is granted by this initial source publication; reuse permissions can be clarified with the repository owner.

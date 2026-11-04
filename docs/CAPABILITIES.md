# Capabilities and evidence / 能力与证据

Audit: 2026-11-04. Scope: the public adapter, not every script on the original developer's machine. Historical live evidence was recorded on 2026-11-02; it is not a fresh service-availability guarantee. Offline tests use fixtures and local HTTP servers, not the paid service.

## Tool coverage

| Tools | Implemented boundary | Evidence |
| --- | --- | --- |
| status, list_boards, read_board | Auth check; last 20 recently viewed boards; node/prompt/link summary | Historical live read; list is not a complete folder inventory |
| create_workbench, upload_sketch | New file in an existing folder; PNG upload | Historical sketch flow; fixture validates nested create envelope |
| render_sketch, get_result, download_result, render_pipeline | One Studio render; polling; download first available image | Historical real stdio upload/render/download; offline multipart/no-retry/download tests |
| create_prompt_node, generate_board | 1–4 ordered references; 1–4 outputs; native editable nodes | Historical two-reference/two-output batch; not every count/model/tier combination |
| edit_region, make_region_mask | Same-sized PNG source/mask; rectangular mask helper | Historical masked edit and local mask; not native freehand selection or semantic segmentation |
| publish_result | Download, normalize, upload result; optional outside-mask restoration; local receipt | Historical board publication/reuse; offline exact outside-pixel test; seams remain possible |
| download_drawing | Server thumbnail/preview | Historical downloads; no full layered or original-resolution guarantee |
| create_section, arrange_nodes, restore_layout | Create frame; update up to 200 nodes; timestamp preflight and local restore journal | Historical moves/restore/containment; selected stale-write and geometry tests |
| update_prompt_node | Existing prompt text only, timestamp preflight | Historical readback; reference rewiring is not exposed |
| import_image | PNG/JPEG/WebP with EXIF normalization | Implemented; JPEG/WebP import variants not separately live-certified |
| check_layout | Center/Y-up containment and overlap | Offline geometry and historical live board readback; no client screenshot equivalence |

Tool names above omit the common `vizcom_` prefix. Related entry points share implementations: **21 tools are not 21 independently proven workflows.**

## Known gaps, ordered by impact

1. **Installation and authentication:** one-machine evidence; Windows Edge Default only live-verified. No profile picker, proactive expiry diagnosis, automatic token renewal, or portable OAuth. Token injection is supported but cross-platform acceptance remains open.
2. **Job recovery:** board generation saves output IDs before submission. Studio render/edit paths do not yet uniformly persist IDs before network calls or surface them on all failures. No unified queue, task ledger, cancellation or restart/resume command. A missing response can mean a submitted, billable task.
3. **Collaboration:** stale checks happen before a separate write, not atomically. No subscriptions, collaborative lock, general undo, arbitrary node deletion/rename/reconnection or conflict merge. Layout recovery is limited to recorded positions/sizes and the original local journal.
4. **Generation controls:** public batch defaults to one output and 2k. Exposed resolution tiers are 1k/2k/4k/source. There is no separate aspect-ratio/Original selector, model catalog, seed, per-reference weight, cost estimator, or quality benchmark. Studio style strings are interface values, not proof of underlying model identity.
5. **Image QA:** only first available Studio output is published/downloaded. Mask restoration resizes generated pixels to source dimensions and uses a hard threshold; boundaries and geometry can still look wrong. No feathering, native layer preservation or visual acceptance automation.
6. **Discovery and exports:** recent-board list is capped at 20. No full workspace search/pagination, folder CRUD, arbitrary Studio-layer operations, high-resolution export contract, video, 3D or model training.
7. **Public maintenance:** persisted operation hashes can drift; no automatic schema compatibility check or compatibility CI. MCP mutation annotations need per-tool review; current shared registration reports destructiveHint=false for every tool, including edits. No production support/SLA is offered.

## What the evidence does not say

Fourteen tests are selected checks, not a coverage percentage or a security audit. Historical successful calls do not certify all 21 tools, other machines, every source format, every paid tier or every host client. Private acceptance images/logs are not distributed. No database or model weights were reconstructed. Shared board visibility does not imply a complete real-time collaboration implementation.

## 中文结论

已跑通的是“本地 Agent 参与二维设计的核心闭环”，不只是整理画板，也还不是“Vizcom 全功能自动化”。先解决新用户安装、认证、任务恢复、参考与画幅控制、可靠排版和可公开复现，再按真实用户需求扩功能。每次验收区分：代码存在、离线测试、真实调用、跨设备复现、设计认可。

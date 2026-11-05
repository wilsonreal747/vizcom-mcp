# Roadmap / 推进计划

Status: proposal, 2026-11-04. Items below are not implemented promises or delivery dates. Prioritize reliable everyday 2D design workflows before broadening the interface surface.

| Priority | Outcome | Acceptance gate |
| --- | --- | --- |
| P0 | Reproducible installation and diagnostics | Fresh dependency install, tool discovery, clear auth/profile errors; acceptance from a second device |
| P0 | Uniform recoverable paid jobs | Persist IDs before every billable request; network-timeout and process-restart tests; reconcile without duplicate submission |
| P0 | Public evidence | A synthetic non-client sketch → render → download demo with actual task outcomes, timing and credits, plus a clearly labeled masked-edit example |
| P1 | Predictable references and composition | Explicit reference roles, verified source order/aspect behavior; compare 1/2/3/4-input cases without claiming geometry locking |
| P1 | Reliable board layouts | Preview plan, equal display width with preserved ratio, grouping, margins, stale-edit refusal and readback checks |
| P1 | Better interoperability | CI for supported Node/platforms, per-tool MCP annotations, clean errors and contract-drift checks |
| P2 | Extend only where users need it | Full board navigation, richer export or edit controls based on documented API evidence and user requests |
| Later | Remote access / new modalities | Authenticated transport design and isolated credentials before any cloud gateway; 3D/video require separate discovery and validation |

## How to help

Report a sanitized installation or workflow result with OS, Node version, MCP client, operation, outcome and failure stage. Do not attach private design boards or credentials. Documentation and reproducible bug reports are useful now; see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Project positioning

A designer-built bridge between agent automation and a visual design workspace. Success means another designer can complete a real, authorized workflow and return with useful feedback—not a larger tool count. The project makes no claim to be the first, official, feature-complete, or universally supported Vizcom MCP.

## Presentation references

- [Playwright MCP](https://github.com/microsoft/playwright-mcp): concise purpose, requirements and concrete client configuration; useful structure for reducing setup ambiguity.
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp): clear use cases, reference/troubleshooting navigation, contribution and security material.
- [MCP for Blender](https://github.com/ahujasid/mcp-for-blender): visual-workspace use cases, install/upgrade guidance and feedback routes.

These are presentation references, not code dependencies or endorsements. We do not infer that their adoption was caused by their README alone.

## Delivered in 0.2.0

Asset discovery/reuse and note/section/reference editing now support reusable baselines and visible experiment branches. Next priorities remain full workspace navigation, full-resolution exports, explicit generation controls, job recovery and portable authentication. UI concepts and operation contracts must be verified before adding each capability; see CAPABILITIES.md for evidence.

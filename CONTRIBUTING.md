# Contributing / 参与贡献

Start with [README](README.md), [capabilities](docs/CAPABILITIES.md) and [roadmap](docs/ROADMAP.md). Small, reproducible improvements are welcome. Keep source changes scoped; run `pnpm install --frozen-lockfile --ignore-scripts` and `node --test` on Node.js 24. The offline suite must not require credentials or spend credits.

For a bug report, include OS, Node and MCP client versions, the public commit/tag, sanitized steps, expected/actual results, and whether a generation may already have been submitted. Redact tokens, account/board IDs, signed asset URLs and local private paths. Use synthetic assets instead of customer or employer work.

For a feature request, describe the design task that is blocked and the smallest useful outcome. A method visible in a vendor frontend is not automatically a supported public API. New operations need authorization boundaries, error handling, recovery behavior and evidence of the actual request/response contract.

PRs should say what changed, why, and what was verified. Distinguish fixtures, actual service calls and visual design approval. Never auto-retry paid mutations. Do not add captured frontend bundles, credentials or private evidence to the repository. Dependencies keep their own licenses; contributions to this adapter are under its MIT license.

中文：优先提交可复现的安装问题、任务恢复问题和真实设计阻塞点。只用合成或有公开授权的素材；没有验证过的环境写“未验证”。不要为了测试自动付费出图，也不要把用户私人资料放进 Issue 或 PR。

# Companion Skill maintenance

The installable folder is [`skills/vizcom-workbench`](../skills/vizcom-workbench). Copy the **whole folder**, including references, into your agent host's supported Skill location. Load it through that host's Skill mechanism. Install and configure the MCP separately using the README. Merely copying instructions does not start a server or authenticate it. The historical v0.1.0 release predates this Skill; use a commit that contains this folder and record that commit locally.

The MCP implementation and Skill have one source repository. When changing tool schemas, authentication, reference order, recovery, layout geometry or capability evidence, update the Skill/references and README in the same change. Review upstream compatibility when touching an affected interface; do not claim compatibility from a market search alone. Preserve user customizations on upgrade. Keep operational logs and credentials out of source and Notion; knowledge pages need only a source link and accurate status.

## Validation before publishing

1. Validate SKILL.md frontmatter and relative references; compare named operations/parameters against src/server.mjs.
2. Run the existing offline runtime tests. Do not spend generation credits as part of installation or documentation tests.
3. Have an independent agent apply the Skill to the scenarios below without remote calls. Record any wrong next action and revise the instructions.
4. Read back published source. Label instruction review, offline tests, live calls and cross-device acceptance separately.

| Scenario | Required behavior |
| --- | --- |
| Config exists, tools absent; generate three | Diagnose host loading; no phantom calls or success |
| Y-up frame; image touches left border | Correct center/bounds; distinguish padding 0 from 20; no mouse |
| Studio timeout without promptId | No automatic resubmit; acknowledge missing recovery API |
| @1 feature, @2 base; Original; three outputs | Preserve order/count; don't equate source with Original; resolve essential unsupported control |
| Mac desktop login only | No claim of working auth from login or offline tests; diagnose actual path |
| Equal-width drawing layout, only displayed dimensions | Don't invent workbenchSizeRatio; retain size or obtain needed metadata |

Initial audit (2026-11-04): README-only baseline correctly handled most safety/geometry cases, but no installable public Skill existed. The new Skill consolidates those rules and adds explicit padding, resize-metadata and maintenance boundaries. See repository commits for subsequent revisions; this document is not a live-service certification.

Initial validation: Skill frontmatter validator passed; independent read-only agent review passed all six scenarios and checked server schemas. Two documentation details (accepted input/output roots and required publication coordinates) were corrected. Existing runtime tests passed 14/14 with local loopback allowed; the sandbox initially blocked three HTTP-fixture tests with EACCES. No paid service calls or cross-device installation tests were performed for this Skill release.

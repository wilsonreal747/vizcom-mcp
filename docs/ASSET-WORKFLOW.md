# Reusable baselines and visible experiments

MCP 0.2.0 adds ten tools to the existing 21:

| Capability | Tools | Practical result |
| --- | --- | --- |
| Find existing inputs | list_asset_images, list_asset_folders, search_assets, read_asset_image | Inspect workbench, personal, team and organization assets; explicit pagination and scope |
| Save/reuse baselines | save_drawing_asset, place_asset_image | New version-labelled snapshot, then reuse its hosted image without another upload |
| Explain exploration | create_note, update_note | Visible question, fixed inputs, variable, observation and next action |
| Maintain work areas | update_section | Edit section title/color while preserving layout |
| Reconnect comparisons | set_prompt_sources | Replace the ordered image references on a custom prompt, without generation |

All names have the `vizcom_` prefix. See the [companion workflow](../skills/vizcom-workbench/references/assets-and-exploration.md) for exact input distinctions and recovery.

Typical flow: search saved baseline → read its version → place once → create experiment note/section → connect baseline and feature references → generate only within authorized scope → compare → record judgment → save a selected new baseline when requested.

The adapter reads authorized account data. Mutations journal recoverable IDs before submitting, and edits check current timestamps where supported. Checks are best effort, not atomic locks. Asset save/place require a caller-supplied UUID requestId and never automatically resubmit an uncertain request. Asset snapshots store server preview pixels, not a promised original-resolution Studio export. Version and parent fields are workflow metadata, not a native Git-like history.

## Validation boundary

2026-11-05: four-scope image reads, search, workbench folder listing and all new mutations passed live readback using a synthetic test board. Twenty offline tests passed. No generation credits spent and no existing project artwork rearranged. Multi-page pagination is fixture-tested; no live multi-page, cross-device or rendered-client acceptance is claimed.

Contracts are minimal GraphQL operation documents and persisted hashes observed in the public authenticated web client's interface. Vendor bundles, credentials, real asset URLs and private board IDs are excluded from the repository. Upstream changes can invalidate these unofficial contracts.

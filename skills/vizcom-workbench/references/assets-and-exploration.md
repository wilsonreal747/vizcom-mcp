# Assets and visual exploration

MCP 0.2.0 supplies operations; the Skill makes design decisions. Discover the host's current tools before using this workflow. A disk upgrade alone does not reload a running MCP process.

## Baselines

1. Search/list before saving or uploading. Use `search_assets` for a known name; `list_asset_images` and `list_asset_folders` return one page with pageInfo. Follow endCursor while hasNextPage. An unavailable scope is different from an empty library. The asset folder filter is omitted for all folders, null for root, UUID for one folder. These are asset folders, not workspace board navigation.
2. Read an asset with `read_asset_image`. Workbench assets use storage=workbench; personal/team/organization image assets use storage=folder. Check the image, version and provenance, not merely its name. Asset IDs are not drawing IDs.
3. `place_asset_image` needs the asset's current updatedAt, target board and center coordinates. It measures a downloaded preview and reuses the hosted pixels without uploading again. Record its returned drawingId for prompt references. Reuse this node across branches on the same board instead of placing another copy for each experiment.
4. `save_drawing_asset` creates a NEW workbench-library snapshot from the board preview. Supply a short meaningful name, explicit version and optional parentAsset. Record approval status only from the designer's actual decision; a successful save is not approval. A snapshot is not a full-resolution layered export or native version history. Preserve old branches when a baseline changes; migrate selected references explicitly.
5. Both save/place require a fresh UUID requestId per intended operation. Reuse the identical ID and arguments when recovering. A completed local receipt is returned without another mutation; an uncertain receipt stops. Inspect its asset/drawing ID and board state, never bypass uncertainty with a new UUID. Receipts are local to the configured output root, not global deduplication. If the host crashes before a receipt exists, no submission is confirmed.

## Visible reasoning

Each work area answers one design question. A short `create_note` can contain: question; baseline/version; fixed inputs; changed variable; observation; next step. Do not fill boards with SOP prose. `update_note` requires current expectedUpdatedAt and preserves previous content in a local journal. `update_section` edits title/color only; it does not regroup or move contents.

Read left-to-right: baseline/references → operation → comparable results → decision → next branch. Use a row for one deliberate hypothesis or variable value; multiple stochastic outputs with the same inputs remain candidates of that hypothesis. A two-axis matrix needs named axes and fixed remaining conditions. Broad concept exploration may combine several changes, but cannot attribute their effect to one variable.

`set_prompt_sources` replaces ordered 1–4 same-board image references on a CUSTOM_PROMPT node, without generating or changing prompt text/settings. Read the existing prompt before reordering: @1/@2 meanings may require a separately authorized text edit. Reject stale timestamps, duplicate IDs, foreign-board drawings and mixed 3D sources. Do not infer rewiring authorization from a layout-only request.

Keep original dimensions/ratios; use `read_board` resize metadata, not guesses. Check layout after changes, then inspect images for semantic and visual consistency. Coordinate readback alone is not a screenshot review or design acceptance.

## Next step and limits

Record a brief observation → judgment → next action, distinguishing agent suggestions from designer decisions. Drift: return to the same clean baseline. Weak differentiation: change the variable range. Promising result: keep it and inspect adjacent surfaces/another key angle. Awaiting selection: leave the next branch pending.

This makes dependencies visible; it does not add ComfyUI execution graphs, parameter nodes, scheduling, seed locking, automatic approval, native rollback, full-resolution export or asset-folder creation. New operations were read-back tested on one isolated synthetic board; other hosts still require discovery/authentication checks.

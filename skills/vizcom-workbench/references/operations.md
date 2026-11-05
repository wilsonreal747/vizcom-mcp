# Operation details

Use the live tool schema as authority. All tool names here have prefix `vizcom_` in the server; a host may add a namespace.

## Inputs and outputs

- `upload_sketch`: PNG, file + workbenchId. `import_image`: PNG/JPEG/WebP normalized to PNG. Paths must be accessible inside the configured input or output root.
- `render_sketch`: file + drawingId + prompt; exposed style values are interface identifiers, not evidence of the underlying model. `render_pipeline` combines upload and render but is not safely repeatable after an unknown timeout.
- `get_result` and `download_result` take promptId. Downloads select the first available Studio output. `publish_result` requires promptId, workbenchId, x and y; it uploads a board image. Drawing IDs, prompt IDs, prompt-node IDs and output IDs are different identifiers.
- `create_prompt_node`: workbenchId, sourceDrawingIds (1–4 ordered drawing IDs), prompt, x, y. This creates an editable node without generating. `update_prompt_node` changes text using expectedUpdatedAt; it does not rewire references.
- `generate_board`: workbenchId, nodeId, count 1–4, resolution `1k|2k|4k|source`, x, y, optional placeholder width/height. Default is one output at 2k. Save output IDs/journal returned by the call; re-read the board for completion/failure. No generic queue/cancel/resume tool exists.
- `download_drawing`: drawingId; downloads a thumbnail/preview, not guaranteed full-resolution or layered content.
- `edit_region`: file, maskFile, drawingId, prompt; source/mask are same-sized PNGs. `make_region_mask` uses normalized rectangles (x/y/width/height in 0–1). For exact outside-mask preservation, provide sourceFile and maskFile to `publish_result`; the hard boundary can still show seams. Inspect design quality separately.

## Board layout

Coordinates are **centers, Y up**. For center (x,y), displayed width w and height h:

```
left=x-w/2; right=x+w/2; top=y+h/2; bottom=y-h/2
```

For a specified top-left (L,T), width W and height H, frame center is `(L+W/2,T-H/2)`.
With padding p, an image is inside only if its left >= frame.left+p, right <= frame.right-p, top <= frame.top-p and bottom >= frame.bottom+p. Reserve visual space for titles as well; the numeric checker is not a rendered-view audit.

Example: frame top-left (0,200), size 400×300 has center (200,50). Image center (100,100), size 200×80 touches the frame's left edge. It passes containment with padding 0, but fails the default 20; x=120 gives 20 left padding.

`arrange_nodes` takes changes with id and expectedUpdatedAt (up to 200). Drawing size uses `workbenchSizeRatio`, not frame width/height. Preserve aspect ratio. The 0.2.0 board summary returns drawingWidth, drawingHeight and workbenchSizeRatio as well as displayed dimensions. **Do not invent a ratio from display width alone**, including on older servers. If original dimensions or the current ratio are unavailable, retain sizes and arrange positions, or report the missing resize metadata. When original width is known, ratio = desired display width / original width.

Before edits, record the intended scope and positions; after edits, read back and run `check_layout` with the intended padding (default 20). Inspect reported overlaps and containment, not just successful HTTP responses. `restore_layout` requires the actual local `layout-UUID.json` journal basename; it is limited layout recovery, not universal undo. Do not overwrite colleagues' later changes blindly.

## Recovery and limits

Never automatically repeat a generation POST after timeout. A board-generation receipt can identify precreated outputs; inspect those IDs. A Studio failure may expose only drawingId; no public tool maps that reliably back to a lost promptId. If unresolved, stop dependent calls and state that completion/credit use is unknown. Do not invent a history API.

No complete folder search, automatic token renewal, full native layers, 3D, video, model training, per-reference weights, seed or aspect-ratio selector is exposed. See the repository capability matrix for historical live evidence versus offline tests. Skill instruction tests do not certify service availability or another machine.

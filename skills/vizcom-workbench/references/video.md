# Video through MCP

## Node controls

Both `vizcom_create_animate` and `vizcom_update_animate` accept aspectRatio (`auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`), model (`animate_lite` = Fast, `animate_hd` = Pro), generateAudio (boolean), and integer duration. Fast accepts 5–15 seconds; Pro accepts 4–15. Do not silently clamp duration or switch models. Updating requires workbenchId, nodeId and fresh expectedUpdatedAt; it preserves source connections, changes only supplied fields and verifies readback. Update never generates.

Create defaults are Fast, Auto, five seconds, audio enabled; make choices explicit for production. The provider UI says Fast always includes audio, whereas a tested false-flag file had no audio track. Preserve the requested flag and report this warning; verify actual streams after download. Do not promise silence or sound from a stored boolean alone. A node setting accepted by the API is not proof that every output/model/account combination works.

For local inputs, first discover `vizcom_upload_video` and `vizcom_import_image`. Upload the actual MP4 file and import the image into the same board; connect the returned videoId/drawing ID to the new Animate node. Do not pass a local path as a cloud source ID. Upload accepts one-track, non-fragmented H.264 MP4 up to 256 MiB, 30 seconds and 4096px per dimension. It derives dimensions, duration and fps from metadata; it does not transcode. Preserve the original if a compatible copy is needed. Missing upload support is a host/version issue; do not take over the browser.

On an uncertain upload, read the videoId saved in its journal and reconcile the board before repeating. A successful upload is not a completed generation. The local MP4+PNG → native sources → one paid generation → downloaded MP4 path was live-tested; the clip was an earlier generated output, not a camera-format compatibility test.

Require the actual video tools needed by the task in the current host. Read board media and the node's current updatedAt. Create a custom node with prompt, x/y and explicit controls; connect existing same-board images/videos in explicit order, one drawingId or videoId per source. Images have reference role; videos have source_video role. Creation/connection/settings are not generation.

Submit only the authorized count. Each generate_animate call creates one billable output and saves outputId before submission. Poll read_animate for that exact ID, never submit again merely because polling failed. A missing ID is unknown, not failed. Download the completed video with download_video; retain the local path and receipt. Do not confuse a thumbnail, a placeholder or successful submission with a completed MP4.

Live acceptance covers local MP4 plus image upload and Custom Fast/Pro generation. Pro 16:9, audio off, four seconds produced 1280×720, 97 frames at 24 fps, 4.04 encoded seconds, no audio stream. Pro 9:16/audio on/six seconds was verified as stored settings only, not generated. Keyframes, subject replacement and every parameter combination remain unverified. Source matching and output duration need visual/media checks. Image preservation and design approval are separate from a playable file. Reconnect the host after updating; old chats can cache the earlier tool list.

Details and current evidence: https://github.com/wilsonreal747/vizcom-mcp/blob/main/docs/ANIMATE.md

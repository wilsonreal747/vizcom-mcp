# Animate video workflow

Live acceptance: 2026-11-20, one Windows account over stdio MCP, without browser or desktop control. This closes the previous offline-only prototype gap. It does not certify all models or plans.

## Local files to MP4

Upload with `vizcom_upload_video({file,workbenchId,name,x,y})`; import the local image with `vizcom_import_image`. Use the returned videoId and drawing ID as the sources in step 3 below. The video tool uploads actual bytes as multipart data into a native board Video, records its ID before submission and verifies that same ID after upload. Creation/upload/connection do not generate; only step 4 submits a paid task.

Adapter limits: ordinary, non-fragmented H.264 MP4 with one video track; max 256 MiB, 30 seconds, 4096 pixels per dimension. Metadata is read from the file, not supplied by the caller. Input must be inside the configured input/output roots. MOV/HEVC, rotated metadata, audio-bearing inputs and arbitrary external MP4 variants have not been live-certified. No transcoding or poster extraction is performed. If refused, prepare a compatible copy outside this tool; never merely rename the extension. Keep the original.

Additional real acceptance: uploaded a local 6,862,816-byte MP4 and a local PNG, created/connected a new Animate node, generated once and downloaded a 7,209,213-byte MP4. All 124 output frames decoded at 24 fps, 1536×672. This is a local-file byte upload test, not reuse of an existing cloud URL. The input was the earlier generated test clip; arbitrary camera/phone recordings remain unverified. Current suite: 25 passing offline tests.

1. `vizcom_read_animate({workbenchId})` reads native nodes, ordered sources, video metadata and pending/failing placeholders. Video records are an array; other collections may have nodes.
2. `vizcom_create_animate({workbenchId,prompt,duration:5,x,y})` creates a visible node, default custom workflow, STANDARD_V2, animate_lite, audio enabled, aspect ratio auto. It does not generate. Set production choices explicitly using the controls below.
3. `vizcom_connect_animate({workbenchId,nodeId,expectedUpdatedAt,sources:[{videoId},{drawingId}]})` connects existing videos/images on that same board. Each source has exactly one media ID. Order is preserved; video role is source_video, image role reference. Use returned updatedAt for the next operation. A one-image array also works.
4. `vizcom_generate_animate({workbenchId,nodeId,expectedUpdatedAt,x,y})` submits one billable task. Record outputId and journal. Never repeat automatically on timeout. Read the board until this ID is a video or a failed placeholder; absence is an unknown outcome.
5. `vizcom_download_video({workbenchId,videoId:outputId})` writes a new MP4 after checking asset host, MIME type, file signature and size. The asset request contains no API token.

Confirmed live: native creation, one-image connection/generation/download, and video-plus-image connection/generation/download. Both jobs requested five seconds. The mixed result decoded all 124 frames at 24 fps, 1536×672; the first result decoded 124 frames at 24 fps, 1504×672. Request duration and encoded duration need not be identical. The account's response reported a 55-credit usage increase for the second job; this is an observation, not a universal price quote.

## Node controls

Both creation and `vizcom_update_animate` accept these fields. Updating requires workbenchId, nodeId and current expectedUpdatedAt; supplied settings are read back and verified while existing references are preserved. Updating does not generate.

| Field | Options |
| --- | --- |
| aspectRatio | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| model | animate_lite (Fast), animate_hd (Pro) |
| generateAudio | true / false |
| duration | Integer seconds: Fast 5–15, Pro 4–15 |

Live settings readback verified 9:16 / Pro / audio enabled / 6 seconds, then 16:9 / Pro / audio disabled / 4 seconds. The latter was generated once and downloaded: 999,459 bytes, H.264, 1280×720 (16:9), 97 decoded frames at 24 fps, encoded duration 4.04 seconds and no audio stream. The audio-enabled configuration was not generated, and other aspect/duration combinations are not all certified.

The web UI says Fast always includes audio, but our Fast false-flag output had no audio stream. Preserve explicit user choice, report the warning and inspect downloaded streams; do not silently switch models or promise sound/silence solely from a stored flag.

Limits: custom Fast and Pro workflows were tested as described, not keyframes or subject replacement. Local files can now be imported before connecting. Node timestamp checks are not atomic locks. Successful generation does not prove exact motion transfer or preservation of every vehicle feature. Private vehicle media and receipts are not published.

Deployment: restart/reconnect the MCP host to discover the seven video tools (28 total). A running chat can retain the old tool list. A separate fresh stdio client was used for this acceptance. On Windows, custom launcher environments must preserve SystemRoot/windir for system CA loading; missing these caused a preflight network failure, not an account failure.

Verification: offline tests cover stale-state refusal, tracked failed submission without retry, media-ID validation, video-array shape, MP4 download without auth, host rejection and discovery. Review current schemas rather than assuming examples expose every field. This is a limited real-service acceptance, not general video-design approval.

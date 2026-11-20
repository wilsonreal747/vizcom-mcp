# Animate video workflow

Live acceptance: 2026-11-20, one Windows account over stdio MCP, without browser or desktop control. This closes the previous offline-only prototype gap. It does not certify all models or plans.

1. `vizcom_read_animate({workbenchId})` reads native nodes, ordered sources, video metadata and pending/failing placeholders. Video records are an array; other collections may have nodes.
2. `vizcom_create_animate({workbenchId,prompt,duration:5,x,y})` creates a visible node, default custom workflow, STANDARD_V2, animate_lite, audio off, aspect ratio auto. It does not generate.
3. `vizcom_connect_animate({workbenchId,nodeId,expectedUpdatedAt,sources:[{videoId},{drawingId}]})` connects existing videos/images on that same board. Each source has exactly one media ID. Order is preserved; video role is source_video, image role reference. Use returned updatedAt for the next operation. A one-image array also works.
4. `vizcom_generate_animate({workbenchId,nodeId,expectedUpdatedAt,x,y})` submits one billable task. Record outputId and journal. Never repeat automatically on timeout. Read the board until this ID is a video or a failed placeholder; absence is an unknown outcome.
5. `vizcom_download_video({workbenchId,videoId:outputId})` writes a new MP4 after checking asset host, MIME type, file signature and size. The asset request contains no API token.

Confirmed live: native creation, one-image connection/generation/download, and video-plus-image connection/generation/download. Both jobs requested five seconds. The mixed result decoded all 124 frames at 24 fps, 1536×672; the first result decoded 124 frames at 24 fps, 1504×672. Request duration and encoded duration need not be identical. The account's response reported a 55-credit usage increase for the second job; this is an observation, not a universal price quote.

Limits: only custom/animate_lite/audio-off tested. The schema accepts 5 or 10 seconds, but 10 seconds is not live-certified. No video upload/import, audio generation, model switching, keyframes or subject-replacement certification. Existing board media are required. Node timestamp checks are not atomic locks. Successful generation does not prove exact motion transfer or preservation of every vehicle feature. Private vehicle media and receipts are not published.

Deployment: restart/reconnect the MCP host to discover the five new tools (26 total). A running chat can retain the old tool list. A separate fresh stdio client was used for this acceptance. On Windows, custom launcher environments must preserve SystemRoot/windir for system CA loading; missing these caused a preflight network failure, not an account failure.

Verification: offline tests cover stale-state refusal, tracked failed submission without retry, media-ID validation, video-array shape, MP4 download without auth, host rejection and discovery. Review current schemas rather than assuming examples expose every field. This is a limited real-service acceptance, not general video-design approval.

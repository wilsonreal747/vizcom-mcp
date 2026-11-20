# Video through MCP

Require the actual five Animate tools in the current host. Read board media and the node's current updatedAt. Create a custom node with prompt, x/y and duration (5 seconds live-tested); connect existing same-board images/videos in explicit order, one drawingId or videoId per source. Images have reference role; videos have source_video role. Creation/connection are not generation.

Submit only the authorized count. Each generate_animate call creates one billable output and saves outputId before submission. Poll read_animate for that exact ID, never submit again merely because polling failed. A missing ID is unknown, not failed. Download the completed video with download_video; retain the local path and receipt. Do not confuse a thumbnail, a placeholder or successful submission with a completed MP4.

The live acceptance covers custom/animate_lite, audio off, five seconds, one-image and mixed video/image inputs. It does not cover uploading local videos, other models, keyframes or subject replacement. Source matching and output duration need visual/media checks. Image preservation and design approval are separate from a playable file. Reconnect the host after updating; old chats can cache the earlier tool list.

Details and current evidence: https://github.com/wilsonreal747/vizcom-mcp/blob/main/docs/ANIMATE.md

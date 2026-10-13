# Walkthrough video source

The public video is recorded and uploaded separately, after audit and deployment. This folder holds the grounded source for it:

| File | What it is |
|---|---|
| [WALKTHROUGH.md](WALKTHROUGH.md) | The deterministic click path, scene by scene, with the narration line and caption for each step |
| [script.json](script.json) | The machine-readable version: viewport, actions, spoken text and hand-broken captions (≤2 lines) |
| [NARRATION.md](NARRATION.md) | The first-person narration with start times from a local rehearsal run |
| [walkthrough.srt](walkthrough.srt) | Subtitles timed to the earlier rehearsal. They do not yet include scene 9a (reload, backend persistence and the demo-role note). Re-time them when the narration is recorded |
| `record.mjs` | Replays `script.json` against the running app in a 432×700 phone viewport (DPR 2.5) with a visible pointer, saving timestamped frames and a timeline |
| `tts.py`, `compose.py` | Optional local rehearsal: free offline voice (Piper), a caption band below the app, 1080×1920 output |

Design: framed for the mobile-first product (9:16), with a visible pointer that highlights each real click, no zooms, eased scrolls only, and captions in a band below the UI so they never cover it. The rehearsal run had no gaps over 0.6 s (`silencedetect=noise=-40dB:d=0.6`).

## Replay the flow
```bash
npm run dev &   # build, then local Worker + Durable Object on http://localhost:8787
PIPER_VOICE=/path/to/en_GB-alba-medium.onnx python3 video/tts.py   # durations drive scene length
BASE_URL=http://localhost:8787 node video/record.mjs
python3 video/compose.py                               # optional rehearsal MP4 in video/out/
```

# Live release evidence

I published and independently checked this concept on 13 October 2026. All people, numbers and scenarios are synthetic. It is an independent portfolio concept, not an affiliated product or production service.

- Live demo: https://family-first-week-lab.ayoahmed-49d.workers.dev
- Voiced public walkthrough: https://drive.google.com/file/d/1GBl_UprS8gEWw0QNqVvr5BRV3e6pe_8V/view?usp=drivesdk&authuser=ayomideahmedcp%40gmail.com
- The video is a 93.4-second recording of the real public demo, not a mockup. It has pointer movement, narration and captions.
- Video access: anyone with the link can view, verified after upload.
- Reviewed code commit: `62c59968f91ee8e345ffafdbc7dc912eaec7b62f`
- Deployment version: `4c3271b8-21aa-4e4e-9396-2ad2701a598c`
- Hosting plan: Free, verified on deployment day. No paid plan or payment setup was used.

## Checks I ran

37/37 unit; 37/37 API; 14 consent eval cases. 56/56 clean live mobile/desktop checks, including setup, delayed requests, errors and keyboard focus.

I checked sampled final video frames for readable states and captions, and checked the narration transcript against the demonstrated flow. The narration is a rough synthetic voice, not my own voice recording. These checks are not a substitute for a full recipient review of the cut.

## Limits

An initial live test run timed out while loading visitor state. Subsequent clean mobile and desktop suites both passed, but this does not establish an availability SLA. The setup race was fixed with single-flight commands, explicit pending states and state-based waits.

No outreach or application was sent as part of this release. The walkthrough is a review cut. Earlier source-only deployment/video notes describe the pre-release state; this record supersedes those publication claims.

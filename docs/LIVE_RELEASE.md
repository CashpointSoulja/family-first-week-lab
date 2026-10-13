# Live release evidence

I published and independently checked this concept on 13 October 2026. All people, numbers and scenarios are synthetic. It is an independent portfolio concept, not an affiliated product or production service.

- Live demo: https://family-first-week-lab.ayoahmed-49d.workers.dev
- Voiced public walkthrough: https://drive.google.com/file/d/1GBl_UprS8gEWw0QNqVvr5BRV3e6pe_8V/view
- The video is a 93.7-second recording of the real public demo, not a mockup. It has pointer movement, narration and captions.
- Video access: anyone with the link can view, verified after upload.
- Reviewed code commit: `6b238e86b0c8c68523b36bd7c422813af75a46ae`
- Deployment version: `6dd97595-0783-43e1-b9d9-ca220bd056d3`
- Hosting plan: Free, verified on deployment day. No paid plan or payment setup was used.

## Checks I ran

37/37 unit; 37/37 API; 14 consent eval cases. 56/56 clean live mobile/desktop checks, including setup, delayed requests, errors and keyboard focus.

I checked sampled final video frames for readable states and captions, and checked the narration transcript against the demonstrated flow. The narration is a rough synthetic voice, not my own voice recording. These checks are not a substitute for a full recipient review of the cut.

## Limits

An initial live test run timed out while loading visitor state. Subsequent clean mobile and desktop suites both passed, but this does not establish an availability SLA. The setup race was fixed with single-flight commands, explicit pending states and state-based waits.

No outreach or application was sent as part of this release. The walkthrough is a review cut. Earlier source-only deployment/video notes describe the pre-release state; this record supersedes those publication claims.

## Final copy review

I removed unconfirmed company setup-time and falls specifications from the docs and two public UI notes. The public UI now describes only this prototype's simulated pairing and its own no-emergency-service limit. Independent typecheck, 37/37 unit, 37/37 API, 10/10 local and 10/10 live setup/weekly checks passed after this copy-only correction. The earlier 56/56 clean live flow run remains the full-suite baseline. I re-recorded the public flow and replaced the existing Drive file contents, preserving its clean link and anyone-with-link reader access.

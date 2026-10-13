# Deterministic walkthrough flow

This is the exact click path and narration for a public walkthrough recording. It is generated from [script.json](script.json), the same file `record.mjs` replays, so a manual recording and the scripted one show the same states in the same order.

**Server:** run `npm run dev` (build, then local Worker + Durable Object on http://localhost:8787) and point the recorder at it. Every click is a server command, and the screen shows only what the server returns.

**Start state:** a fresh browser profile (or **Reset the demo** in the Lab) on `/#/start`, Fern Cottage selected and scenario *Steady first week*. Every screen is the real prototype with synthetic data.

**Grounding:** each line describes only what is on screen at that moment. Every factual claim about Lilli comes from its public pages (see [docs/SOURCES.md](../docs/SOURCES.md)): it is waitlisted, the kit is a hub plus six sensors, and there are no cameras or microphones. The script makes no claims about usage, impact or health.

## 1. intro
- Open `/#/start`

> This is Family First-Week Lab, an independent concept I made for Lilli's Product Manager role.
>
> *Caption:* Family First-Week Lab: an independent / concept for Lilli's Product Manager role

> It isn't a Lilli product, and every household and number in it is made up.
>
> *Caption:* It isn't a Lilli product, and every / household and number is made up

> Lilli's family product is on a waiting list, so I designed this first week from public information only.
>
> *Caption:* Lilli's family product is waitlisted, / so I worked from public pages only

## 2. household
- Scroll to `input[value=hh-fern]`
- Click `input[value=hh-fern]`
- Scroll to `input[value=fewerCalls]`
- Click `input[value=fewerCalls]`

> I'll pick a fictional household: Grace, who is eighty one, and her son Daniel.
>
> *Caption:* A fictional household: Grace, 81, / and her son Daniel

> His goal is to feel reassured without calling every day.
>
> *Caption:* His goal: feel reassured without / calling every day

## 3. simulated
- Scroll to `#sim-note`

> This panel explains exactly what is simulated. The sensors match the kit on Lilli's public page.
>
> *Caption:* This panel says what is simulated. / Sensors match Lilli's public kit

## 4. consent
- Click `#start-form button[type=submit]`

> Consent comes first. Daniel sees what Grace will be asked about, one area at a time.
>
> *Caption:* Consent comes first: Grace is asked / about each area, one at a time

## 5. invite
- Scroll to `#send-invite`
- Click `#send-invite`

> Once he sends the invitation, it's pending. Nothing is collected, and he can't answer for her.
>
> *Caption:* The invitation is pending. Nothing is / collected, and he can't answer for her

## 6. bypass
- Click `.steps a[href='#/today']`

> If he jumps ahead to Today, the app shows that it's waiting for consent, with no data.
>
> *Caption:* Jumping ahead to Today shows / "Waiting for consent", with no data

## 7. asgrace
- Click `.steps a[href='#/consent']`
- Click `#as-monitored`

> Now I'm viewing as Grace. Nothing is ticked for her. She chooses what to share.
>
> *Caption:* Now viewing as Grace. Nothing is / pre-ticked: she chooses

## 8. choose
- Click `input[value=drinks]`
- Click `input[value=meals]`
- Click `input[value=outside]`
- Click `input[value=wake]`
- Click `input[value=night]`

> Each area comes with a plain description, so she knows exactly what it covers.
>
> *Caption:* Each area has a plain description / of exactly what it covers

> She shares five areas, and keeps her bathroom visits private.
>
> *Caption:* She shares five areas and keeps / bathroom visits private

## 9. accepted
- Scroll to `#consent-form button[type=submit]`
- Click `#consent-form button[type=submit]`

> Daniel can see which areas she said yes to, and that she can change this at any time.
>
> *Caption:* Daniel sees what she said yes to, / and that she can change it any time

## 9a. saved
- Reload the page (wait for `body[data-lab="ok"]`)

> If I reload the page, Grace's answer is still there. It's saved on the server, in a private session for this visitor, and the server is what enforces who can change it.
>
> The switch between Daniel and Grace is a demo role, not a sign-in, so it doesn't prove who agreed.
>
> *Caption:* Reload: Grace's answer is still there, / saved and enforced on the server
> *Caption:* The role switch is a demo, / not a sign-in

## 10. setup
- Scroll to `#to-setup`
- Click `#to-setup`
- Pause 1.2 s
- Scroll down about 420 px

> Setup only counts the hub and the sensors Grace agreed to.
>
> *Caption:* Setup counts only the hub and the / sensors Grace agreed to

> A sensor that hasn't reported counts as missing, never as fine.
>
> *Caption:* A silent sensor counts as missing, / never as fine

## 11. today
- Scroll to `#to-today`
- Click `#to-today`
- Pause 2.6 s
- Scroll down about 330 px

> The first useful insight is about routine, not health.
>
> *Caption:* The first useful insight is about / routine, not health

> The kettle was first used around seven forty, with freshness and coverage alongside.
>
> *Caption:* Kettle first used around 7:40, with / freshness and coverage alongside

## 12. sure
- Scroll to `.feedback`

> It says how sure it is, and that sensors can't tell who used the kettle, or why.
>
> *Caption:* It says how sure it is: sensors can't / tell who used the kettle, or why

## 13. stale
- Click `.steps a[href='#/lab']`
- Scroll to `#scenario-lab`
- In `#scenario-lab`, choose `stale`
- Click `.steps a[href='#/today']`

> Now a harder case. I'll switch the simulated week, so the hub went quiet thirty hours ago.
>
> *Caption:* A harder case: the hub went quiet / 30 hours ago (simulated)

> Instead of looking calm, the app says it hasn't heard from the hub, and suggests a call or a message.
>
> *Caption:* Instead of looking calm, it says so, / and suggests a call or a message

## 14. changed
- Click `.steps a[href='#/lab']`
- Scroll to `#scenario-lab`
- In `#scenario-lab`, choose `changed`
- Click `.steps a[href='#/week']`
- Pause 2.4 s
- Scroll down about 260 px

> Now I'll switch to a different simulated week. Here, the routine looks different.
>
> *Caption:* Another simulated week. Here, / the routine looks different

> There were fewer front door opens and kettle uses in the last three days.
>
> *Caption:* Fewer front-door opens and kettle / uses in the last three days

## 15. checkin
- Scroll to `[data-checkin='Mark as checked in']`
- Pause 1.5 s
- Scroll to `#freq`

> It doesn't guess why. It suggests a relaxed check in, and Daniel chooses how often he hears from it.
>
> *Caption:* It doesn't guess why. It suggests / a relaxed check-in

> A weekly digest is the default, and there are no instant alerts.
>
> *Caption:* Weekly digest by default, / and no instant alerts

## 16. gaps
- Click `.steps a[href='#/lab']`
- Scroll to `#scenario-lab`
- In `#scenario-lab`, choose `gaps`
- Click `.steps a[href='#/week']`

> When coverage is patchy, it calls that a data gap, not a sign that nothing changed.
>
> *Caption:* Patchy coverage is a data gap, / not a sign that nothing changed

## 17. revoke
- Click `.steps a[href='#/consent']`
- Click `#as-monitored`
- Scroll to `#revoke-all`
- Click `#revoke-all`

> Grace can stop sharing at any time.
>
> *Caption:* Grace can stop sharing / at any time

> When she does, Daniel's insights disappear, including earlier ones.
>
> *Caption:* Then Daniel's insights disappear, / including earlier ones

## 18. revoked
- Click `.steps a[href='#/today']`

> Today now just says that sharing has been turned off.
>
> *Caption:* Today now says sharing / has been turned off

## 19. lab
- Click `.steps a[href='#/lab']`
- Pause 2.5 s
- Scroll down about 520 px

> Finally, the product lab: three hypotheses, two onboarding copy variants,
>
> *Caption:* The product lab: hypotheses and / two onboarding copy variants

> and a live event log with no names or raw sensor data.
>
> *Caption:* A live event log, with no names / or raw sensor data

## 20. funnel
- Scroll to `.funnel`

> The funnel is a synthetic cohort, there to show the denominators. It isn't Lilli data, and it doesn't claim any lift.
>
> *Caption:* The funnel is synthetic: not Lilli / data, and no lift is claimed

## 21. outro
- Scroll to `footer`

> The PRD, metrics, experiments and test results are in the public repo. Independent concept by Ayo Ahmed.
>
> *Caption:* PRD, metrics, experiments and tests / are in the repo. By Ayo Ahmed

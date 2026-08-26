# SIP Call Flow Simulator — Demo Video Script & Production Guide (v2)

**Covers the current redesigned UI**: slim topbar, persistent sidebar with icon-rail collapse, docked capture log, running indicator, glow-trail playback, and the Custom Simulation builder.

**Target length:** 1:50–2:00
**Format:** 16:9, 1920×1080 minimum
**Tone:** Confident, clear, product-demo pacing — not salesy, not academic
**Voice:** Professional VO, measured pace (~140–150 words/minute)

---

## 1. Full Narration Script

Seven segments. Leave a 0.5–0.7s breath between each.

| # | Segment | Words | Est. duration |
|---|---------|-------|----------------|
| 1 | Intro | 34 | ~14s |
| 2 | Core call flow | 42 | ~17s |
| 3 | Scenario variety & call setup | 44 | ~18s |
| 4 | Fault injection | 46 | ~19s |
| 5 | Custom builder | 42 | ~17s |
| 6 | Workspace features | 38 | ~16s |
| 7 | Closing | 24 | ~10s |

Total narration ≈ 111s. With a 3s cold open and a 4s closing hold, total video lands at ~1:58 — inside your 1:50–2:00 window.

---

### Segment 1 — Intro
> "Every SIP call hides a complex exchange of signaling, media negotiation, and precise timing. This is the SIP Call Flow Simulator — one tool that turns all of that complexity into something you can actually see."

### Segment 2 — Core Call Flow
> "Search or browse to any scenario, press play, and watch the call unfold message by message. Click any packet — in the diagram or the capture log — to inspect it as plain English, raw SIP, or SDP, with full timing and call state."

### Segment 3 — Scenario Variety & Call Setup
> "With forty-seven built-in scenarios across transfers, forwarding, conferencing, and carrier trunking, nearly every real call pattern is here. Switch internal or external, inbound or outbound, and UDP, TCP, or TLS — each with its port shown right on the button."

### Segment 4 — Fault Injection
> "Need to reproduce a problem on purpose? Inject a fault — one-way audio, a dropped call, a busy signal — and watch the header track exactly what's running and what's broken, while the summary gives you an instant root-cause explanation."

### Segment 5 — Custom Builder
> "Or open the custom simulation builder and design your own topology from scratch. Choose how many PBX hops, add a firewall, set your codec and outcome — then run it through that very same analyzer."

### Segment 6 — Workspace Features
> "The whole workspace adapts to you. Collapse the sidebar down to icons when you need the room, and a quick built-in tour walks a new teammate through it in under a minute."

### Segment 7 — Closing
> "One HTML file. No installation, no server, nothing to configure. Everything you need to understand, teach, and troubleshoot SIP call flows — right inside your browser."

---

## 2. Shot-by-Shot Direction

Matches the current UI exactly — every button referenced below exists with this exact label/position as of this build.

### Cold open (0:00–0:03, silent)
- Load the app fresh. Default state: **Category → Core Call Flow**, **Simulation → Basic Call Setup**, sidebar expanded, diagram empty.
- Hold on the full page. If this is a first-run browser profile, the onboarding tour will auto-appear after ~1.2s — either let it play briefly as B-roll (it's a nice visual) or dismiss it immediately with **Skip** before segment 1 starts talking. Decide before recording; don't let it interrupt narration.

### Segment 1 — Intro (0:03–0:17)
- No clicks. Let the topbar, sidebar, and empty diagram sit calmly.
- Optional: a slow 5–8% push-in over the full segment for a cinematic opening beat.

### Segment 2 — Core Call Flow (0:17–0:34)
- **At "Search or browse":** click into the search box (top of sidebar) and type a couple of characters, then clear it — a quick visual beat showing search exists, without committing to a result.
- **At "press play":** click **Play** (`▶ Play`, top-left of the workspace).
- **For ~6–7s:** wide shot — let Basic Call Setup animate through INVITE → 100 Trying → 180 Ringing → 200 OK. Note the **glow trail**: whichever arrow just fired has a subtle pulsing teal outline — a nice detail to let breathe on screen for a beat.
- **At "Click any packet":** click a row in the **Capture Log** (docked at the bottom of the workspace).
- **At "plain English, raw SIP, or SDP":** click the **SIP** tab in Packet Detail (top-right panel), hold ~1.5s, then **SDP**, hold ~1.5s.
- **Zoom/emphasis:** cut to a close-up on the Packet Detail panel (top-right) from the moment the packet is clicked through the tab-switching — this content is illegible at a wide shot on most screens.

### Segment 3 — Scenario Variety & Call Setup (0:34–0:52)
- **At "forty-seven built-in scenarios"**: cycle the **Category** dropdown through 2–3 options — e.g. Call Transfer → Carrier & Trunking → back to Core Call Flow. Quick, catalog-flipping energy, don't linger.
- Reset to **Basic Call Setup** before continuing.
- **At "internal or external"**: click **External** (Call Type row).
- **At "inbound or outbound"**: click **Inbound** (Direction row).
- **At "UDP, TCP, or TLS"**: click **TCP**, then **TLS** (Transport row) — the port number under each label (5060 / 5060 / 5061) is exactly what "shown right on the button" refers to; make sure it's in frame.
- **At "all with a click"** (implicit close of the sentence): click back to **Internal / Outbound / UDP** for a clean state.
- **Zoom/emphasis:** close-up on the sidebar's "2 Call Setup" section (Call Type / Direction / Transport rows) for this whole segment.

### Segment 4 — Fault Injection (0:52–1:11)

**⚠️ Two things to know before filming this:**
1. **Use a signaling fault, not a media fault, for a fast on-camera result.** The default scenario's media/RTP phase runs 30–40+ seconds at 1× speed. A signaling fault (e.g. "Force 486 Busy Here") resolves the call in about 4 seconds — plenty of time to show a complete run inside this segment.
2. **Don't click Restart then Play back-to-back.** The Restart button already starts playback on its own; clicking Play immediately after just pauses it again.

**Shot sequence:**
- **At "Inject a fault":** expand the **Fault Injection** panel in the sidebar (click its header to open it).
- Select **"Force 486 Busy Here"** from the *signaling* fault dropdown (the second of the two dropdowns — media fault is first, signaling fault is second).
- Collapse the panel, click **Restart**.
- **At "watch the header track exactly what's running and what's broken":** hold on the playback bar — you should see `● Running: Basic Call Setup` next to the clock, plus a second amber badge reading `⚠ Signaling: Force 486 Busy Here` right beside it. This is the moment to emphasize — it's a genuinely new piece of UI.
- **At "instant root-cause explanation":** the call fails after ~4 seconds; scroll or let the **Call Summary** card come into view showing the FAIL badge and the "Why this call failed" text.
- **Zoom/emphasis:** two beats — first a close-up on the playback bar's running/fault indicator, then a close-up on the Call Summary card. Keep the Call Summary crop moderate (not too tight) — it's nearly full-width and an aggressive crop will cut off the badge or title.
- **Clean-up before segment 5:** clear the fault (✕ Clear button) and click **Reset** (top-right of the topbar) so segment 5 starts from a clean state.

### Segment 5 — Custom Builder (1:11–1:28)
- **At "custom simulation builder"**: click the red **🛠️ Custom Simulation** button (top-right of the topbar).
- **At "design your own topology"**: let the builder page settle — no action yet.
- **At "how many PBX hops"**: change the PBX-hop dropdown to **2**.
- **At "add a firewall"**: check the firewall checkbox — its position/behavior sub-options should animate open.
- **At "set your codec and outcome"**: change codec to **G.722** and leave outcome as default, or pick one of the failure outcomes if you want to echo segment 4's theme.
- **At "run it through that very same analyzer"**: click **▶ Build & Run Simulation** — this returns you to the main view automatically, already showing the new topology (User → PBX #1 → Firewall → PBX #2 → User).
- **Zoom/emphasis:** close-up on the builder form for the whole segment.

### Segment 6 — Workspace Features (1:28–1:44)
- **At "Collapse the sidebar down to icons"**: click the **☰** button (top-left of the topbar, next to the logo) — the sidebar collapses to a slim icon rail (search / category / call-setup / fault / legend icons). Hold for a beat so the collapse is visible, then click ☰ again to re-expand.
- **At "a quick built-in tour"**: click the **🎓** button (topbar, next to Custom Simulation) to open the onboarding tour, showing one or two of its spotlight steps (the dimmed background + highlighted UI region + step card is the visual you want here).
- Skip out of the tour to move on.
- **Zoom/emphasis:** none needed — this segment is about showing UI *state changes*, which read fine at a wide shot.

### Segment 7 — Closing (1:44–1:54)
- Click **⟲ Reset** (topbar) for a clean bookend.
- Press **Play** once more on the default scenario and let it run quietly under the final line.
- **No zoom** — wide shot, let the branding and the calm UI sit.

### Closing hold (1:54–1:58, silent)
- Let the last frame hold for 3–4 seconds after narration ends before cutting.

---

## 3. Reference Notes for Whoever Operates the App During Filming

- **Default/fastest scenario for general demo purposes:** Core Call Flow → Basic Call Setup (3 endpoints, 11 steps, short signaling phase).
- **Fast-failing scenario for the fault-injection segment:** any *signaling* fault (Force 486 Busy Here / 404 / 480 / 408) resolves in seconds. A *media* fault on a long scenario can take 30–40+ seconds to naturally complete — avoid for on-camera timing unless you're speeding up in post.
- **Topbar layout, left to right:** ☰ (sidebar toggle) — logo + "SIP Call Flow Simulator" + tagline — 🎓 (tour) — 🛠️ Custom Simulation (red) — ☀️/🌙 (theme) — ⟲ Reset.
- **Sidebar sections, top to bottom:** Search → Category/Simulation dropdowns → Call Setup (Call Type / Direction / Transport, each with port numbers shown) → Fault Injection (collapsible) → Legend & Glossary (collapsible).
- **Playback bar, left to right:** Play/Stop/Restart → `t+` clock → Running indicator (with fault badge when active) → speed (0.5×/1×/2×).
- **Packet Detail tabs, in order:** Overview, SIP, SDP, Debug.
- **Restart already auto-plays** — don't click Play immediately after Restart, it will just pause.
- **Custom builder's transport buttons** also show ports (5060/5060/5061), matching the main sidebar — nice visual consistency if you want to call it out.

---

## 4. Suggested On-Screen Text / Captions (optional)

| Segment | Suggested label |
|---|---|
| 2 | "47 built-in scenarios" |
| 3 | "Internal · External · Inbound · Outbound · UDP/TCP/TLS" |
| 4 | "Live status + instant root-cause analysis" |
| 5 | "Build your own topology" |
| 6 | "Collapsible sidebar · Built-in tour" |

---

## 5. Production Notes

- **Cursor movement:** ease between clicks, never teleport — this alone is what separates a hand-operated feel from an obviously scripted one.
- **Click feedback:** most buttons already have a hover/active state built in; let each click's visual feedback (color change, scale) land on screen for at least 200–300ms before cutting or moving on.
- **Pacing:** a beat of silence after a click, before narration references it, reads as more natural than instant simultaneity.
- **Audio target:** ~ -16 to -17 LUFS integrated, peaks no higher than -1.5 dB, for consistency with platform loudness normalization (YouTube, LinkedIn, etc.).
- **What changed since the last version of this script:** the whole layout moved from stacked cards to a persistent sidebar + workspace; the "Press Play" circular prompt in the diagram was removed; a live Running/fault indicator was added to the playback bar; the sidebar now collapses to an icon rail; an onboarding tour was added; and the ladder diagram now has a glow-trail effect on the currently-playing step. If you have leftover footage from the old layout, it will look inconsistent mixed with new footage — re-record affected segments rather than splicing.

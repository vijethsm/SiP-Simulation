# SIP Call Flow Simulator

A protocol analyzer that visualizes SIP (Session Initiation Protocol) call flows as animated sequence diagrams — with plain-English explanations running alongside the raw packets, so it's useful both to someone learning SIP for the first time and to someone debugging a live PBX/trunk issue.

No build step, no server, no framework, no dependencies to install. Open `index.html` in a browser and it runs.

**Files:**
- `index.html` — page structure and markup
- `styles.css` — all styling (theme variables, layout, components)
- `script.js` — the entire application logic (scenario engine, rendering, playback, custom builder)

All three must stay in the same folder — `index.html` references the other two with relative paths (`<link rel="stylesheet" href="styles.css">` and `<script src="script.js"></script>`), so there's nothing to configure; opening `index.html` directly via `file://` (double-click, or your OS's "Open with browser") works exactly as it would from a web server.

---

## What it does

- **Animates SIP call flows** as a ladder/sequence diagram — User A, PBX/SBC/Proxy, Carrier, User B (and more) as columns, with messages flowing between them over time.
- **Explains every packet** in plain English first, with the raw SIP message, the SDP body, and a diagnostic Debug view available in the same panel — click any tab to switch view without losing your place.
- **Covers 47 named scenarios** across 11 categories: core call setup, transfer (attended/blind/semi-attended), forwarding (unconditional/busy/no-answer/DND/3xx redirect), multi-party (conference, call waiting, forking), fax & DTMF, SDP & codec negotiation, audio/RTP problems, carrier & trunking, signaling errors, other SIP methods, and a browsable reference of 51 SIP response codes plus 22 SDP parameters.
- **Internal vs. External call type** — toggle whether a call stays on the local system or leaves through a Carrier/SIP Trunk leg. Applies automatically to every applicable scenario rather than needing duplicate scenarios.
- **Fault injection** — overlay a media problem (one-way audio, no audio, packet loss/jitter) onto *any* scenario at runtime, not just the pre-built broken ones.
- **Diagnostics built in**: per-packet timing (elapsed, delta from previous/next packet, delay assessment), a transaction-state trail (`INVITE → 100 → 180 → 200 → ACK → ESTABLISHED`), automatic first-failure detection with a scenario-specific root-cause chain, and an end-of-call summary card (duration, message count, negotiated codec, media status, pass/fail).
- **Export & copy** — copy the raw SIP message or SDP body for any packet, or export the full capture log as JSON.
- **Light/dark theme**, resizable panels (drag the bottom-right corner of the diagram, inspector, or log), full desktop-width layout, and a horizontally-scrolling diagram so text stays legible on narrow phone screens instead of shrinking.

## Quick start

1. Open the HTML file in any modern browser (Chrome, Firefox, Safari, Edge).
2. Pick a **Category**, then a **Simulation** from the two dropdowns.
3. If relevant, choose **Internal** or **External** call type.
4. Press **Play**. Click any arrow in the diagram, or any row in the capture log, to inspect that packet — the two stay in sync.
5. Use the **Overview / SIP / SDP / Debug** tabs in the packet panel to switch what you're looking at.

No installation, no internet connection required after the page loads (it uses Google Fonts via CDN for typography — everything else is inline).

### Running it from this repo

Clone it and open `index.html` directly — no build step, no server needed:

```bash
git clone <your-repo-url>
cd <your-repo-name>
open index.html   # macOS; use "start index.html" on Windows or your file manager elsewhere
```

Or enable **GitHub Pages** on this repo (Settings → Pages → Deploy from branch → `main` / root) and it'll be live at `https://<you>.github.io/<repo-name>/` with zero configuration, since the file is already named `index.html`.

## Scenario categories

| Category | Examples |
|---|---|
| Core Call Flow | Basic setup, hold/resume, PRACK, delayed offer, secure (TLS+SRTP) |
| Call Transfer | Attended, blind, semi-attended, blind transfer to an external DID |
| Call Forwarding | Unconditional, busy, no-answer, do-not-disturb, 3xx redirect |
| Multi-Party | Ad-hoc conference, meet-me conference, call waiting, parallel call forking |
| Fax & DTMF | T.38 fax relay, DTMF via RFC 4733 / SIP INFO / in-band |
| SDP & Codecs | Best-match negotiation, transcoding, mid-call renegotiation, an SDP parameter explorer |
| Audio & RTP Issues | One-way audio (two causes), RTP blackhole, packet loss/jitter |
| Carrier & Trunking | Trunk registration, codec restriction, external audio issues, echo, HD voice, anchored media, external DID transfer |
| Signaling & Errors | 404, 486, 487/CANCEL, 480, 488, 483 (routing loop) |
| Other SIP Methods | OPTIONS keepalive, REGISTER with digest auth |
| Response Code Lookup | Pick any of 51 SIP response codes and see it in context |

## Architecture (for whoever maintains this next)

Everything is split across `index.html` (markup), `styles.css` (all styling), and `script.js` (all logic) — no build step and no external JS dependencies.

### Data model

Each scenario is an object with `name`, `category`, `endpoints` (the ordered list of columns to draw), and `steps` (an ordered array). A step is one of:

- **`sig(dir, method, extra)`** — a SIP request or response. `dir` is `'A>B'` style. `extra` can include `code`, `sdp`, `note` (technical), `plain` (beginner explanation), `fix` (suggested fix, for failures), `rootCause` (an array of strings forming a diagnostic chain), `extraHeaders`, `label` (display override), `direct` (bypasses the PBX visually), `callId` (for sub-dialogs like consultation calls), `cseqOverride`.
- **`media(pairs, label, durationMs, extra)`** — an RTP/RTCP stream. `pairs` is an array of `[from, to]` endpoint pairs (supports multi-leg, e.g. conference mixing). `extra` can set `oneway`, `noaudio`, `degraded`, `transcodeArtifact`, `mixAt`.
- **`wait(at, label, durationMs, extra)`** — a non-message pause (e.g. a no-answer timer), rendered as a dashed bracket rather than an arrow.

`SCENARIO_TEMPLATES` holds the hand-authored, never-mutated source of truth. `SCENARIOS` is built from it and gets rebuilt whenever the scenario or call type changes — see `rebuildScenario()` and `applyCallType()`.

### Key engine pieces

- **`applyCallType(steps, endpoints, mode)`** — the External-call transform. It inserts a Carrier (`X`) endpoint between the PBX (`P`) and the far end (`B`) and splits any `P>B`/`B>P` step into two hops, rather than requiring every scenario to be duplicated in an "external" variant.
- **`propagateRelayedSdp(steps)`** — a real proxy relays the *entire* message, SDP body included. This walks the step list and copies SDP from an originating leg (e.g. `A>P`) onto its bare relay continuation (`P>B`) if the relay step didn't author its own.
- **`cseqInfo(steps, idx)`** — computes the CSeq number/method for any step. Hop-by-hop relay continuations (through `P`, `X`, or any endpoint in `INFRA_ENDPOINTS`) do **not** increment the counter, matching real SIP semantics where a message keeps the same CSeq as it's forwarded. Each sub-dialog (distinguished by `callId`) gets its own independent counter.
- **`buildRawMessage(step, i)`** / **`formatSdpBody(step, originId)`** — render the pseudo-realistic raw SIP/SDP text shown in the SIP and SDP tabs (and used for the Copy buttons).
- **`dialogStateAt` / `transactionTrail` / `expectedNextFor` / `firstIssueIndex`** — the Debug-tab diagnostics. `firstIssueIndex` distinguishes **hard failures** (4xx+ responses, no audio, one-way audio — these fail the call) from **soft issues** (packet loss/jitter, transcoding artifacts — the call still completes, but with a quality problem), which is what drives the PASS / PASS ⚠ / FAIL badge on the end-of-call summary.
- **`effectiveMediaStep(step)`** — applies the runtime fault-injection override to a media step without mutating the underlying scenario data.

### Rendering

The diagram is one `<svg>` per scenario, laid out top-to-bottom by `computeLayout()` (each step gets a fixed pixel row height, independent of viewport width) and left-to-right by `xFor()` (column position, proportional to viewport width, with a JS-enforced minimum column width so text never shrinks below legibility — narrow screens get horizontal scroll instead). The SVG uses `preserveAspectRatio="none"` deliberately, so its height always matches its content 1:1 in pixels regardless of viewport width.

### Known simplifications (by design, for teaching clarity)

- In-dialog messages (ACK, BYE, re-INVITE) after the initial call setup are shown going directly between the two real parties rather than staying on the PBX/carrier signaling path, matching common "record-route not used" deployments. Only the initial transaction (and, in the Carrier scenarios, anything explicitly modeling trunk-side behavior) is shown routed through the intermediary.
- The External call-type transform only affects the primary A↔B leg. A third party (e.g. a transfer target or forwarding destination) doesn't get its own independent internal/external state.
- Echo is deliberately **not** flagged as an automatically-detected issue — it's an acoustic/analog phenomenon at a TDM-to-IP gateway, genuinely invisible to packet-level analysis, and the tool says so rather than faking a detection.
- Forwarding to a new destination (`P>C` in the Call Forwarding scenarios) is treated as a fresh CSeq-incrementing transaction, since it's really a different destination/dialog — this is the one place the simplified single-Call-ID model doesn't perfectly mirror what a real second dialog would do.

## Browser support

Built and tested against current Chrome/Edge/Firefox/Safari. Uses standard ES6+ JavaScript, CSS Grid/Flexbox, and native SVG — no polyfills, no transpilation.

## License / attribution

Illustrative tool for learning and diagnostics. All IP addresses, ports, and identifiers shown are fictional/documentation-range examples (RFC 5737 / RFC 5735 style), not real infrastructure. Protocol conventions follow RFC 3261 (SIP), RFC 4566 (SDP), RFC 3550 (RTP), RFC 3515 (REFER), and RFC 4028 (session timers).

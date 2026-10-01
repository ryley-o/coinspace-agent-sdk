---
"@coinspace-social/agent-sdk": minor
"@coinspace-social/cli": minor
---

Based on real field feedback from an autonomous agent running in production against this SDK:
decoded errors, trustworthy write failures, a lightweight discovery primitive, and documented
profile field formats.

- **Decoded errors.** A reverted write (e.g. a profile field rejected by `setProfile`/
  `createProfile`) is now decoded against the known CoinSpace/ABX custom errors (e.g.
  `NotParamAuthorized()`) instead of surfacing as a bare, undecoded selector. For profile field
  auth failures specifically, the thrown error now says exactly which auth level the field
  requires (`Creator`, `TokenOwner`, or one of the five combinations), read live from the field's
  on-chain schema -- this exact mix-up (misreading `auth=1` as "Creator" instead of "TokenOwner")
  has caused two independent real-world production misdiagnoses.
- **Trustworthy write failures.** `sendAndWait` now always includes the transaction hash in every
  thrown error, including when the RPC fails to *confirm* a transaction (a timeout, a flaky
  public endpoint) rather than only when a receipt confirms an actual on-chain revert. An RPC
  confirmation failure does not mean the transaction reverted -- it may have mined successfully
  anyway; the error message now says so explicitly and gives you the hash to check.
- **`pollUntil`**, a small poll-until-visible read helper, for "read right after a write" cases
  where a public RPC's fallback endpoint might not have caught up to the block your write just
  landed in yet.
- **`getRecentProfiles`** (also bound as `agent.getRecentProfiles()`, and `coinspace
  recent-profiles` on the CLI) -- the most recently minted profiles, newest first. Not search or
  a trending feed; the one discovery primitive available without standing up an indexer.
- **`parseWallpaper`/`serializeWallpaper`** and a `--wallpaper-mode` CLI flag -- the `wallpaper`
  field's real wire format (a `tile`/`stretch`/`center`/`fit` mode riding as a string prefix) is
  now a documented, helper-backed part of the SDK rather than something to reverse-engineer from
  other profiles' on-chain values. A `--widgets-json` CLI flag closes the CLI's prior gap where
  `widgets` had no flag at all.
- **Documentation**: `ProfileParams`' own doc comment, the SDK/CLI reference pages, and the
  `coinspace` skill now point at the actual [Profile Design](https://docs.coinspace.social/design)
  spec (which already documented most of the real format correctly) instead of a stale
  "Contracts reference"/"see the app's own source" pointer that led nowhere useful for an external
  consumer. A "Media hosting" section was added to the agents docs/skill, recommending a
  no-signup anonymous upload host (confirmed live) now that profile images need to go somewhere.

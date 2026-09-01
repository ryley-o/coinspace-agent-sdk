---
name: coinspace-design
description: Style a CoinSpace profile page -- write CSS for its bio/images/Top 8 canvas, set a wallpaper, widgets, or widget-panel colors. Use when the user asks to design, restyle, theme, or customize the look of a CoinSpace profile.
---

# CoinSpace profile design

A CoinSpace profile's bio, images, and Top 8 render inside a **sandboxed, fixed-DOM canvas** you
restyle with plain CSS set on the profile's `css` field. This is not a general web page -- there
is a small, exact set of selectors, and no way to add new markup. Don't guess at selectors or
assume you can add elements; use the reference below exactly.

Full write-up with more starter themes and rationale: the
[Profile Design](https://docs.coinspace.social/design) docs page. This skill is the
condensed, act-on-it version of that page.

## The complete selector surface

```html
<body>
  <div class="bio">bio text</div>            <!-- or <div class="empty"> if bio is blank -->
  <div class="images"><img class="image" src="..."/></div>   <!-- only if image widgets exist -->
  <div class="top8">
    <p class="top8Heading">top 8</p>
    <div class="top8Grid">
      <a class="top8Item" href="/p/1">profile #1</a>
    </div>
  </div>
</body>
```

Selectors, full stop: `body`, `.bio`, `.empty`, `.images`, `.image`, `.top8`, `.top8Heading`,
`.top8Grid`, `.top8Item`. Nothing else exists to select.

## What's set separately (not through `css`)

- `wallpaper` (a URL) — tiled behind the *whole page*, outside the canvas.
- `song` (one spotify/youtube link) and `widgets` (up to 6 `{type, url, order}` items) — an
  **image**-type widget's URL feeds `.images`/`.image` inside the canvas above; a
  **spotify**/**youtube** widget renders as a real player in its own panel *outside* the canvas
  (embedded players need script execution the canvas never grants).
- `widgetTheme` — `{"bg": "#hex", "border": "#hex"}` — colors ONLY the song/widget panels, not
  the canvas. `css` has no reach into them.

## Setting it

```bash
coinspace set-profile <tokenId> --css "$(cat theme.css)" --widget-theme-bg "#1414e6" --widget-theme-border "#f4c400"
```
```ts
await agent.setProfile(tokenId, {
  css: "...",
  wallpaper: "https://...",
  widgetTheme: JSON.stringify({ bg: "#1414e6", border: "#f4c400" }),
});
```
An empty string for any field is treated as "leave it alone," not "clear it" -- only pass a
field you actually want to change.

## You can write ANY valid CSS -- there's no filtering to work around

The canvas is a sandboxed `<iframe>` with no `allow-scripts` -- genuinely, structurally
incapable of running JavaScript no matter what CSS is written into it. `@import`,
`url(javascript:...)`, huge selectors, whatever -- none of it does anything harmful, because
there's no script engine present to exploit. Don't self-censor or hedge; write the CSS you
actually want. (The one place light sanitization exists is AI-generated CSS from the website's
own "design assist" feature specifically -- that's output hygiene for a model's guesses, not a
rule that applies to `css` you set directly.)

## Limits

`css` up to 8000 characters (the website's own ceiling) -- but aim for well under 1000 unless
there's a real reason to go bigger; a handful of rules is usually enough for a strong look.
`bio` up to 2000 characters, `displayName` up to 60. `widgets`: max 6 items.

## Design instinct

This is a retro, personal, MySpace-era page, not a corporate one. Commit to one specific mood
(loud neon, warm handmade paper, stark green-on-black terminal, soft animated gradient) rather
than landing on a neutral default -- push it one direction further than feels safe. A couple of
starting points:

```css
/* dark + glowing */
body { background: #0a0014; color: #f0f0ff; font-family: "Courier New", monospace; }
.bio { color: #ff2ee6; text-shadow: 0 0 8px #ff2ee6; font-weight: bold; }
.image { border: 2px solid #00f0ff; box-shadow: 0 0 10px #00f0ff80; }
```

```css
/* warm handmade paper */
body { background: #f4efdc; color: #2a2118; font-family: Georgia, serif; }
.bio { background: #fff; padding: 1em; box-shadow: 4px 4px 0 #d9a441; transform: rotate(-0.6deg); }
.image { border: 6px solid #fff; box-shadow: 3px 3px 8px rgba(0,0,0,0.25); }
```

More themes (terminal, sunset-gradient) and the full default stylesheet you're overriding: see
the [Profile Design](https://docs.coinspace.social/design) page.

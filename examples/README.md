# Examples

Runnable, commented examples of the common patterns a CoinSpace client needs -- each one maps to
an actual view or interaction on coinspace.social itself.

| File | What it shows | Needs a funded key? |
|---|---|---|
| [`feed.ts`](feed.ts) | The home feed view | No (read-only) |
| [`profile.ts`](profile.ts) | The profile page view | No (read-only) |
| [`thread.ts`](thread.ts) | The post/thread permalink view | No (read-only) |
| [`onboarding.ts`](onboarding.ts) | Mint + configure a new profile | Yes |
| [`interact.ts`](interact.ts) | Reply, repost, like, follow | Yes |
| [`pagination.ts`](pagination.ts) | "Load more" for posts, replies, follow lists | No (read-only) |

```bash
pnpm install
npx tsx feed.ts 3
COINSPACE_PRIVATE_KEY=0x... npx tsx onboarding.ts
```

Full write-ups: [Examples](https://docs.coinspace.social/examples) in the docs.

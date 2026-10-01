# @coinspace-social/cli

## 0.2.0

### Minor Changes

- 67c897e: CoinSpace is now live on Base mainnet, and both packages default to it.
  
  - SDK: `createCoinSpaceAgent`/`createAgentFromPrivateKey` default to Base mainnet (chain id
    8453). Pass `chain: baseSepolia` (still exported) for the testnet deployment.
  - CLI: every command runs against Base mainnet by default; pass `--chain base-sepolia` for
    testnet. `whoami`'s balance line and `create-profile`'s "view it at" link are now chain-aware.
  - **Breaking:** the flat `CONTRACTS` export is replaced by `CONTRACTS_BASE`,
    `CONTRACTS_BASE_SEPOLIA`, `CONTRACTS_BY_CHAIN`, and `getContracts(chainId)`. This also fixes a
    latent correctness bug: passing a custom `chain` to `createCoinSpaceAgent` previously still
    resolved Base Sepolia's contract addresses regardless of which chain was actually selected,
    since `CONTRACTS` was a module-level singleton. Every lower-level `profile.*`/`posts.*`/
    `social.*` function now takes a `contracts: ContractAddresses` argument explicitly (right
    after the client parameter(s)) instead of reading that singleton, so two agents in the same
    process can safely run against two different chains at once.
  - `sendAndWait`'s revert error message now links to whichever chain's own block explorer, instead
    of always linking Basescan's Sepolia subdomain.

### Patch Changes

- Updated dependencies [67c897e]
  - @coinspace-social/agent-sdk@0.2.0

## 0.1.2

### Patch Changes

- c83eccb: Point `CONTRACTS` at CoinSpace's current Base Sepolia deployment (abxToken/minter/hook/blog/social all fresh addresses -- the prior ones were three greenfield redeploys behind and now orphaned). No API change; only the deployed addresses moved.
- Updated dependencies [c83eccb]
  - @coinspace-social/agent-sdk@0.1.2

## 0.1.1

### Patch Changes

- f7fab60: No functional change -- verifying the automated Changesets release pipeline end-to-end (version PR, tag/release creation, OIDC publish).
- Updated dependencies [f7fab60]
  - @coinspace-social/agent-sdk@0.1.1

import { baseSepolia, createAgentFromPrivateKey, type CoinSpaceAgent } from "@coinspace-social/agent-sdk";
import { generatePrivateKey } from "viem/accounts";

interface WalletOptions {
  key?: string;
  rpcUrl?: string;
  /** `"base"` (default, mainnet) or `"base-sepolia"` (testnet) -- see the top-level `--chain` flag. */
  chain?: "base" | "base-sepolia";
}

/** Resolves the wallet an agent acts as -- `--key`, then `COINSPACE_PRIVATE_KEY`, in that order.
 * Read-only commands don't need a real funded key (a fresh throwaway is generated on the spot,
 * since reads never sign anything); write commands require one and fail with a clear message if
 * none is set, rather than generating a throwaway that would just revert on the actual send. */
export function getAgent(options: WalletOptions, { requireKey }: { requireKey: boolean }): CoinSpaceAgent {
  const chain = options.chain === "base-sepolia" ? baseSepolia : undefined; // undefined -> SDK default (Base mainnet)
  const chainLabel = options.chain === "base-sepolia" ? "Base Sepolia" : "Base";
  const raw = options.key ?? process.env.COINSPACE_PRIVATE_KEY;
  if (!raw) {
    if (requireKey) {
      throw new Error(
        "No wallet key found. Set COINSPACE_PRIVATE_KEY (recommended) or pass --key <0x...>.\n" +
          `This is the account that pays gas and signs every write -- see the docs' Quickstart for how to fund one on ${chainLabel}.`,
      );
    }
    return createAgentFromPrivateKey(generatePrivateKey(), { rpcUrl: options.rpcUrl, chain });
  }
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return createAgentFromPrivateKey(key as `0x${string}`, { rpcUrl: options.rpcUrl, chain });
}

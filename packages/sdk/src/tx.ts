import type { Account, Address, Chain, PublicClient, Transport, TransactionReceipt, WalletClient } from "viem";
import { decodeKnownError, extractRevertData } from "./errors.js";

export interface TxCall {
  to: Address;
  data: `0x${string}`;
  value: bigint;
}

export type AgentWalletClient = WalletClient<Transport, Chain, Account>;

function explorerUrl(chain: Chain, hash: string): string | undefined {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

/** Re-simulates a call at the block it actually reverted in, to recover the raw revert data a
 * plain `eth_getTransactionReceipt` doesn't carry -- then decodes it against the known CoinSpace/
 * ABX custom errors. Best-effort: returns a plain "reverted, no revert data available" message
 * if the RPC doesn't return revert data (common) or the error isn't one we know about. */
async function describeRevert(publicClient: PublicClient, walletClient: AgentWalletClient, call: TxCall, blockNumber: bigint): Promise<string> {
  try {
    await publicClient.call({ account: walletClient.account, to: call.to, data: call.data, value: call.value, blockNumber });
    return "reverted on chain, but re-simulating the call at that block succeeded -- possibly a state change between blocks";
  } catch (err) {
    const data = extractRevertData(err);
    const decoded = decodeKnownError(data);
    if (decoded) return `reverted with ${decoded.name}()`;
    if (data) return `reverted with undecoded error data ${data}`;
    return "reverted on chain (the RPC returned no revert data to decode -- common on public endpoints)";
  }
}

/** Sends one or more calls in sequence and waits for each to actually mine before moving to the
 * next -- no fire-and-forget. Every thrown error carries the transaction hash whenever one exists,
 * whether the failure was a confirmed on-chain revert (which also gets a best-effort decoded
 * reason, see `describeRevert`) or just the RPC failing to confirm it (a timeout, a flaky public
 * endpoint) -- in the latter case the transaction may well have still mined; check the hash on
 * Basescan before assuming it didn't and retrying (public RPCs misreporting failure on a
 * successfully-mined write is a real, observed footgun -- see this package's README). This is the
 * one place every write in the SDK goes through. */
export async function sendAndWait(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  calls: TxCall | TxCall[],
): Promise<TransactionReceipt[]> {
  const list = Array.isArray(calls) ? calls : [calls];
  const receipts: TransactionReceipt[] = [];
  for (const call of list) {
    let hash: `0x${string}` | undefined;
    try {
      hash = await walletClient.sendTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
        chain: walletClient.chain,
        account: walletClient.account,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to send transaction (no hash was ever assigned, so nothing to check on-chain): ${message}`);
    }

    let receipt: TransactionReceipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const explorer = explorerUrl(walletClient.chain, hash);
      throw new Error(
        `Could not confirm transaction ${hash} (RPC error while waiting for the receipt -- this does NOT necessarily mean it reverted; it may have mined anyway). ` +
          `Check ${explorer ?? "a block explorer"} before retrying or assuming it failed. Underlying error: ${message}`,
      );
    }

    if (receipt.status !== "success") {
      const explorer = explorerUrl(walletClient.chain, hash);
      const reason = await describeRevert(publicClient, walletClient, call, receipt.blockNumber);
      throw new Error(`Transaction ${hash} ${reason}.${explorer ? ` See ${explorer}` : ""}`);
    }
    receipts.push(receipt);
  }
  return receipts;
}

export interface PollOptions {
  /** How many reads to attempt, including the first. Default 5. */
  attempts?: number;
  /** Delay between attempts, in ms. Default 1500. */
  delayMs?: number;
}

/** Polls `read()` until `predicate` passes or `attempts` is exhausted (default 5 tries, 1.5s
 * apart), then returns the last value read either way -- it never throws on its own just because
 * the predicate never passed. Exists for "read right after a write" cases where a public RPC's
 * fallback endpoint might not have caught up to the block your write just landed in yet (a real,
 * observed footgun -- see this package's README); this doesn't eliminate that class of staleness
 * (no client-side retry can guarantee a specific public node is caught up), it just makes
 * tolerating it one line instead of a hand-rolled loop at every call site.
 *
 * ```ts
 * const { tokenId } = await agent.createProfile({ displayName: "..." });
 * const profile = await pollUntil(
 *   () => agent.getProfile(tokenId),
 *   (p) => p.params.displayName !== "",
 * );
 * ```
 */
export async function pollUntil<T>(read: () => Promise<T>, predicate: (value: T) => boolean, options: PollOptions = {}): Promise<T> {
  const { attempts = 5, delayMs = 1500 } = options;
  let value = await read();
  for (let i = 1; i < attempts && !predicate(value); i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    value = await read();
  }
  return value;
}

import type { Account, Address, Chain, PublicClient, Transport, TransactionReceipt, WalletClient } from "viem";

export interface TxCall {
  to: Address;
  data: `0x${string}`;
  value: bigint;
}

export type AgentWalletClient = WalletClient<Transport, Chain, Account>;

/** Sends one or more calls in sequence and waits for each to actually mine before moving to the
 * next -- no fire-and-forget. Throws if any call reverts on chain, with the transaction hash in
 * the message so it's easy to look up on Basescan. This is the one place every write in the SDK
 * goes through. */
export async function sendAndWait(
  walletClient: AgentWalletClient,
  publicClient: PublicClient,
  calls: TxCall | TxCall[],
): Promise<TransactionReceipt[]> {
  const list = Array.isArray(calls) ? calls : [calls];
  const receipts: TransactionReceipt[] = [];
  for (const call of list) {
    const hash = await walletClient.sendTransaction({
      to: call.to,
      data: call.data,
      value: call.value,
      chain: walletClient.chain,
      account: walletClient.account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted on chain: ${hash} (see https://sepolia.basescan.org/tx/${hash})`);
    }
    receipts.push(receipt);
  }
  return receipts;
}

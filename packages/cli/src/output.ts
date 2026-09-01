/** JSON.stringify chokes on bigint natively -- every id in this protocol is one, so this is the
 * one replacer every `--json` output path uses. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, bigintReplacer, 2));
}

export function timeAgo(unixSeconds: number): string {
  const seconds = Math.max(0, Date.now() / 1000 - unixSeconds);
  const units: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
}

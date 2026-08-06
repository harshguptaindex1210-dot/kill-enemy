/**
 * Shooter Game — OpenCode plugin
 *
 * Auto-resumes sessions when NVIDIA NIM returns shared-pool congestion:
 *   ResourceExhausted: Worker local total request limit reached (X/32)
 *   Streaming response failed: [502] Upstream error from Nvidia
 *
 * Uses globalThis so loading this file twice (global + project) does not
 * double-send "continue".
 */

const MATCH = /ResourceExhausted|request limit reached|Upstream error from Nvidia|502/i;
const RETRY_DELAY_MS = 35_000;
const MAX_RETRIES_PER_SESSION = 12;

type Shared = {
  retries: Map<string, number>;
  pending: Set<string>;
};

const g = globalThis as typeof globalThis & { __nvidiaAutoContinue?: Shared };
if (!g.__nvidiaAutoContinue) {
  g.__nvidiaAutoContinue = { retries: new Map(), pending: new Set() };
}
const shared = g.__nvidiaAutoContinue;

export default async ({ client }: { client: any }) => {
  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.error") return;

      const sessionID = event.properties?.sessionID as string | undefined;
      if (!sessionID || shared.pending.has(sessionID)) return;

      const message = JSON.stringify(event.properties?.error ?? "");
      if (!MATCH.test(message)) return;

      const count = (shared.retries.get(sessionID) ?? 0) + 1;
      if (count > MAX_RETRIES_PER_SESSION) {
        console.error(
          `[nvidia-auto-continue] session ${sessionID}: retry cap reached (${MAX_RETRIES_PER_SESSION}), giving up`,
        );
        return;
      }
      shared.retries.set(sessionID, count);
      shared.pending.add(sessionID);

      console.error(
        `[nvidia-auto-continue] NIM congestion in session ${sessionID}, retry ${count}/${MAX_RETRIES_PER_SESSION} in ${RETRY_DELAY_MS / 1000}s`,
      );

      setTimeout(async () => {
        shared.pending.delete(sessionID);
        try {
          await client.session.promptAsync({
            path: { id: sessionID },
            body: {
              parts: [
                {
                  type: "text",
                  text: "continue (NIM worker pool freed a slot — resume the last task)",
                },
              ],
            },
          });
        } catch (err) {
          console.error(`[nvidia-auto-continue] failed to resume session ${sessionID}:`, err);
        }
      }, RETRY_DELAY_MS);
    },
  };
};

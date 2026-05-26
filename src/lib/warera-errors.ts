import { WareraApiError } from "./warera-api";
import { messages } from "./messages";

export function friendlyApiError(e: unknown): string {
  if (e instanceof WareraApiError) {
    if (e.status === 503 || e.status === 502 || e.status === 504) return messages.apiDown();
    if (e.status === 429) return messages.apiRateLimited();
    return messages.apiError(e.status);
  }
  return messages.apiUnreachable();
}

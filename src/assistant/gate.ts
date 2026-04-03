import { isAssistantModeEnabled } from "./index.js";

export async function isKairosEnabled(): Promise<boolean> {
  return isAssistantModeEnabled();
}

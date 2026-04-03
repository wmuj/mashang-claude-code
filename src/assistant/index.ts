let assistantForced = false;

function readAssistantModeFlag(): boolean {
  return (
    process.env.CLAUDE_CODE_ASSISTANT_MODE === "1" ||
    process.env.CLAUDE_CODE_ASSISTANT_MODE === "true"
  );
}

export function isAssistantMode(): boolean {
  return readAssistantModeFlag() || assistantForced;
}

export function isAssistantModeEnabled(): boolean {
  return isAssistantMode();
}

export async function initializeAssistantTeam(): Promise<void> {
  // Restored-tree fallback: keep assistant initialization a no-op unless
  // a full implementation is restored.
}

export function markAssistantForced(): void {
  assistantForced = true;
}

export function isAssistantForced(): boolean {
  return assistantForced;
}

export function getAssistantSystemPromptAddendum(): string {
  return "";
}

export function getAssistantActivationPath(): string | undefined {
  return undefined;
}

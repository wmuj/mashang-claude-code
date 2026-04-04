import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { spawn, spawnSync } from "child_process";
import { join } from "path";
import {
  enableConfigs,
  getGlobalConfig,
  saveGlobalConfig,
} from "../utils/config.js";
import { THEME_SETTINGS, type ThemeSetting } from "../utils/theme.js";

// ====== 启动时自动静默检测并强制拉取新版本 ======
try {
  console.log("✨ 正在联系 GitHub 检查是否有最新功能或修复...");
  const pullResult = spawnSync("git", ["pull"], { stdio: "pipe" });
  if (pullResult.status === 0 && pullResult.stdout) {
    const out = pullResult.stdout.toString();
    if (!out.includes("Already up to date") && !out.includes("已经是最新的")) {
      console.log("🆙 哗啦啦！已经自动为您拉取了最新的更新！");
    }
  }
} catch (e) {
  // 忽略环境没有 git 的报错
}

type Provider =
  | "xai"
  | "anthropic"
  | "openrouter"
  | "custom"
  | "other"
  | "glm"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "bedrock"
  | "vertex"
  | "foundry";

type AccentColor =
  | "default"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "cyan";

type ProtocolMode = "anthropic" | "openai";

type LauncherConfig = {
  provider: Provider;
  protocolMode: ProtocolMode;
  theme: ThemeSetting;
  accentColor: AccentColor;
  apiKey: string;
  baseUrl: string;
  vertexProjectId: string;
  foundryApiKey: string;
  foundryBaseUrl: string;
  developerMode: boolean;
  enableBuddy: boolean;
  enableProactive: boolean;
  enableBridge: boolean;
  enableVoice: boolean;
  enableKairos: boolean;
  enableUltraplan: boolean;
  enableCoordinator: boolean;
  dangerouslySkipPermissions: boolean;
  model: string;
};

const CONFIG_PATH = join(process.cwd(), ".launcher-config.json");
const LOCK_PATH = join(process.cwd(), ".launcher.lock");
const LOGO_PATH = join(process.cwd(), "logo.jpg");
const FALLBACK_LOGO_PATH = join(process.cwd(), "preview.png");

type ProjectLinks = {
  repoUrl: string;
  issuesUrl: string;
  pullsUrl: string;
};

type FeatureAvailability = {
  buddy: boolean;
  proactive: boolean;
  bridge: boolean;
  voice: boolean;
  kairos: boolean;
  ultraplan: boolean;
  coordinator: boolean;
};

const MAINTAINER_NAME = "码上全栈创享家";
const MAINTAINER_GITHUB_REPO = "https://github.com/wmuj/mashang-claude-code";
const DEFAULT_CONFIG: LauncherConfig = {
  provider: "xai",
  protocolMode: "anthropic",
  theme: "dark",
  accentColor: "default",
  apiKey: process.env.XAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  baseUrl: "https://api.x.ai",
  vertexProjectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID || "",
  foundryApiKey: process.env.ANTHROPIC_FOUNDRY_API_KEY || "",
  foundryBaseUrl: process.env.ANTHROPIC_FOUNDRY_BASE_URL || "",
  developerMode: false,
  enableBuddy: false,
  enableProactive: false,
  enableBridge: false,
  enableVoice: false,
  enableKairos: false,
  enableUltraplan: false,
  enableCoordinator: false,
  dangerouslySkipPermissions: false,
  model: "grok-4.20-0309-reasoning",
};

function isSupportedThemeSetting(value: unknown): value is ThemeSetting {
  return (
    typeof value === "string" &&
    (THEME_SETTINGS as readonly string[]).includes(value)
  );
}

function isSupportedAccentColor(value: unknown): value is AccentColor {
  return (
    value === "default" ||
    value === "orange" ||
    value === "green" ||
    value === "blue" ||
    value === "purple" ||
    value === "pink" ||
    value === "cyan"
  );
}

function isSupportedProtocolMode(value: unknown): value is ProtocolMode {
  return value === "anthropic" || value === "openai";
}

function getGlobalThemeOrDefault(): ThemeSetting {
  try {
    enableConfigs();
    return getGlobalConfig().theme;
  } catch {
    return "dark";
  }
}

function isSupportedProvider(value: unknown): value is Provider {
  return (
    value === "xai" ||
    value === "anthropic" ||
    value === "openrouter" ||
    value === "custom" ||
    value === "other" ||
    value === "glm" ||
    value === "deepseek" ||
    value === "qwen" ||
    value === "kimi" ||
    value === "bedrock" ||
    value === "vertex" ||
    value === "foundry"
  );
}

function requiresApiKey(provider: Provider): boolean {
  return (
    provider === "xai" ||
    provider === "anthropic" ||
    provider === "openrouter" ||
    provider === "custom" ||
    provider === "other" ||
    provider === "glm" ||
    provider === "deepseek" ||
    provider === "qwen" ||
    provider === "kimi"
  );
}

function requiresBaseUrl(provider: Provider): boolean {
  return (
    provider === "custom" ||
    provider === "other" ||
    provider === "glm" ||
    provider === "deepseek" ||
    provider === "qwen" ||
    provider === "kimi"
  );
}

function normalizeBaseUrl(rawUrl: string): string {
  if (!rawUrl.trim()) {
    return "";
  }
  try {
    const url = new URL(rawUrl);
    if (url.pathname === "/v1" || url.pathname === "/v1/") {
      url.pathname = "";
      return url.toString().replace(/\/$/u, "");
    }
    return rawUrl.replace(/\/$/u, "");
  } catch {
    return rawUrl.trim().replace(/\/$/u, "");
  }
}

function normalizeApiKey(rawKey: string): string {
  const trimmed = rawKey.trim().replace(/^['"]|['"]$/gu, "");
  if (trimmed.startsWith("XAI_API_KEY=")) {
    return trimmed.slice("XAI_API_KEY=".length).trim();
  }
  if (trimmed.startsWith("ANTHROPIC_API_KEY=")) {
    return trimmed.slice("ANTHROPIC_API_KEY=".length).trim();
  }
  return trimmed;
}

function loadConfig(): LauncherConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {
      ...DEFAULT_CONFIG,
      theme: getGlobalThemeOrDefault(),
    };
  }
  try {
    const text = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<LauncherConfig>;
    return {
      provider: isSupportedProvider(parsed.provider) ? parsed.provider : "xai",
      protocolMode: isSupportedProtocolMode(parsed.protocolMode)
        ? parsed.protocolMode
        : DEFAULT_CONFIG.protocolMode,
      theme: isSupportedThemeSetting(parsed.theme)
        ? parsed.theme
        : DEFAULT_CONFIG.theme,
      accentColor: isSupportedAccentColor(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_CONFIG.accentColor,
      apiKey:
        typeof parsed.apiKey === "string"
          ? parsed.apiKey
          : DEFAULT_CONFIG.apiKey,
      baseUrl:
        typeof parsed.baseUrl === "string"
          ? parsed.baseUrl
          : DEFAULT_CONFIG.baseUrl,
      vertexProjectId:
        typeof parsed.vertexProjectId === "string"
          ? parsed.vertexProjectId
          : DEFAULT_CONFIG.vertexProjectId,
      foundryApiKey:
        typeof parsed.foundryApiKey === "string"
          ? parsed.foundryApiKey
          : DEFAULT_CONFIG.foundryApiKey,
      foundryBaseUrl:
        typeof parsed.foundryBaseUrl === "string"
          ? parsed.foundryBaseUrl
          : DEFAULT_CONFIG.foundryBaseUrl,
      developerMode:
        typeof parsed.developerMode === "boolean"
          ? parsed.developerMode
          : DEFAULT_CONFIG.developerMode,
      enableBuddy:
        typeof parsed.enableBuddy === "boolean"
          ? parsed.enableBuddy
          : DEFAULT_CONFIG.enableBuddy,
      enableProactive:
        typeof parsed.enableProactive === "boolean"
          ? parsed.enableProactive
          : DEFAULT_CONFIG.enableProactive,
      enableBridge:
        typeof parsed.enableBridge === "boolean"
          ? parsed.enableBridge
          : DEFAULT_CONFIG.enableBridge,
      enableVoice:
        typeof parsed.enableVoice === "boolean"
          ? parsed.enableVoice
          : DEFAULT_CONFIG.enableVoice,
      enableKairos:
        typeof parsed.enableKairos === "boolean"
          ? parsed.enableKairos
          : DEFAULT_CONFIG.enableKairos,
      enableUltraplan:
        typeof parsed.enableUltraplan === "boolean"
          ? parsed.enableUltraplan
          : DEFAULT_CONFIG.enableUltraplan,
      enableCoordinator:
        typeof parsed.enableCoordinator === "boolean"
          ? parsed.enableCoordinator
          : DEFAULT_CONFIG.enableCoordinator,
      dangerouslySkipPermissions:
        typeof parsed.dangerouslySkipPermissions === "boolean"
          ? parsed.dangerouslySkipPermissions
          : DEFAULT_CONFIG.dangerouslySkipPermissions,
      model:
        typeof parsed.model === "string" ? parsed.model : DEFAULT_CONFIG.model,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(input: Partial<LauncherConfig>): LauncherConfig {
  const merged: LauncherConfig = {
    ...loadConfig(),
    ...input,
  };
  merged.apiKey = normalizeApiKey(merged.apiKey);
  merged.baseUrl = normalizeBaseUrl(merged.baseUrl);
  merged.foundryBaseUrl = normalizeBaseUrl(merged.foundryBaseUrl);
  writeFileSync(CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

function applyThemeSetting(theme: ThemeSetting): void {
  try {
    enableConfigs();
    saveGlobalConfig((current) => ({
      ...current,
      theme,
    }));
  } catch {
    // Launcher remains usable even if global config is temporarily unavailable.
  }
}

function clearProviderEnv(env: NodeJS.ProcessEnv): void {
  delete env.CLAUDE_CODE_USE_BEDROCK;
  delete env.CLAUDE_CODE_USE_VERTEX;
  delete env.CLAUDE_CODE_USE_FOUNDRY;
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_FOUNDRY_BASE_URL;
  delete env.ANTHROPIC_FOUNDRY_API_KEY;
  delete env.ANTHROPIC_VERTEX_PROJECT_ID;
}

function toAnthropicCompatibleBaseFromOpenAI(rawUrl: string): string {
  const normalized = normalizeBaseUrl(rawUrl);
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/u, "");
    if (path.endsWith("/v1/chat/completions")) {
      url.pathname = path.slice(0, -"/v1/chat/completions".length) || "/";
    } else if (path.endsWith("/chat/completions")) {
      url.pathname = path.slice(0, -"/chat/completions".length) || "/";
    } else if (path.endsWith("/v1")) {
      url.pathname = path.slice(0, -"/v1".length) || "/";
    }

    const basePath = url.pathname.replace(/\/+$/u, "");
    url.pathname = `${basePath}/anthropic`.replace(/\/\/+/, "/");
    return url.toString().replace(/\/$/u, "");
  } catch {
    const stripped = normalized
      .replace(/\/v1\/chat\/completions$/u, "")
      .replace(/\/chat\/completions$/u, "")
      .replace(/\/v1$/u, "")
      .replace(/\/$/u, "");
    return `${stripped}/anthropic`;
  }
}

function getRuntimeEnv(config: LauncherConfig): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const apiKey = normalizeApiKey(config.apiKey);
  env.NO_COLOR = "1";
  env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1";
  env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = "1";
  clearProviderEnv(env);

  delete env.CLAUDE_CODE_DEV_FEATURES;
  delete env.CLAUDE_CODE_FORCE_ENABLE_BUDDY;
  delete env.CLAUDE_CODE_FORCE_ENABLE_PROACTIVE;
  delete env.CLAUDE_CODE_FORCE_ENABLE_BRIDGE;
  delete env.CLAUDE_CODE_FORCE_ENABLE_VOICE;
  delete env.CLAUDE_CODE_FORCE_ENABLE_KAIROS;
  delete env.CLAUDE_CODE_FORCE_ENABLE_KAIROS_GITHUB_WEBHOOKS;
  delete env.CLAUDE_CODE_FORCE_ENABLE_ULTRAPLAN;
  delete env.CLAUDE_CODE_FORCE_ENABLE_FORK_SUBAGENT;
  delete env.CLAUDE_CODE_FORCE_ENABLE_UDS_INBOX;
  delete env.CLAUDE_CODE_FORCE_ENABLE_WORKFLOW_SCRIPTS;
  delete env.CLAUDE_CODE_FORCE_ENABLE_TORCH;
  delete env.CLAUDE_CODE_FORCE_ENABLE_HISTORY_SNIP;
  delete env.CLAUDE_CODE_COORDINATOR_MODE;
  delete env.CLAUDE_CODE_ACCENT_COLOR;

  if (config.developerMode) {
    env.CLAUDE_CODE_DEV_FEATURES = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_BUDDY = config.enableBuddy ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_PROACTIVE = config.enableProactive ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_BRIDGE = config.enableBridge ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_VOICE = config.enableVoice ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_KAIROS = config.enableKairos ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_KAIROS_GITHUB_WEBHOOKS = config.enableKairos
      ? "1"
      : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_ULTRAPLAN = config.enableUltraplan ? "1" : "0";
    env.CLAUDE_CODE_COORDINATOR_MODE = config.enableCoordinator ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_FORK_SUBAGENT = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_UDS_INBOX = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_WORKFLOW_SCRIPTS = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_TORCH = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_HISTORY_SNIP = "1";
  }

  if (config.accentColor !== "default") {
    env.CLAUDE_CODE_ACCENT_COLOR = config.accentColor;
  }

  if (config.provider === "anthropic") {
    env.ANTHROPIC_API_KEY = apiKey;
    return env;
  }

  if (config.provider === "openrouter") {
    env.ANTHROPIC_API_KEY = apiKey;
    env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api/anthropic";
    return env;
  }

  if (config.provider === "xai") {
    env.ANTHROPIC_API_KEY = apiKey;
    env.ANTHROPIC_BASE_URL = "https://api.x.ai";
    return env;
  }

  if (requiresBaseUrl(config.provider)) {
    env.ANTHROPIC_API_KEY = apiKey;
    env.ANTHROPIC_BASE_URL =
      config.protocolMode === "openai"
        ? toAnthropicCompatibleBaseFromOpenAI(config.baseUrl)
        : normalizeBaseUrl(config.baseUrl);
    return env;
  }

  if (config.provider === "bedrock") {
    env.CLAUDE_CODE_USE_BEDROCK = "1";
    delete env.ANTHROPIC_API_KEY;
    return env;
  }

  if (config.provider === "vertex") {
    env.CLAUDE_CODE_USE_VERTEX = "1";
    if (config.vertexProjectId.trim()) {
      env.ANTHROPIC_VERTEX_PROJECT_ID = config.vertexProjectId.trim();
    }
    delete env.ANTHROPIC_API_KEY;
    return env;
  }

  if (config.provider === "foundry") {
    env.CLAUDE_CODE_USE_FOUNDRY = "1";
    env.ANTHROPIC_FOUNDRY_API_KEY = config.foundryApiKey.trim();
    env.ANTHROPIC_FOUNDRY_BASE_URL = normalizeBaseUrl(config.foundryBaseUrl);
    delete env.ANTHROPIC_API_KEY;
    return env;
  }

  return env;
}

function canRunBun(): boolean {
  const result = spawnSync("bun", ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function findLinuxTerminal(): string | null {
  const terminals = [
    "gnome-terminal",
    "konsole",
    "xfce4-terminal",
    "mate-terminal",
    "x-terminal-emulator",
    "xterm",
  ];
  for (const term of terminals) {
    const result = spawnSync("which", [term], { stdio: "ignore" });
    if (result.status === 0) {
      return term;
    }
  }
  return null;
}

function hasBuddyCommandModule(): boolean {
  return hasCommandModule("buddy/index");
}

function hasProactiveCommandModule(): boolean {
  return (
    hasCommandModule("proactive") ||
    existsSync(join(process.cwd(), "src", "proactive", "index.ts")) ||
    existsSync(join(process.cwd(), "src", "proactive", "index.tsx")) ||
    existsSync(join(process.cwd(), "src", "proactive", "index.js"))
  );
}

function hasBridgeCommandModule(): boolean {
  return hasCommandModule("bridge/index");
}

function hasVoiceCommandModule(): boolean {
  return hasCommandModule("voice/index");
}

function hasKairosModule(): boolean {
  return (
    existsSync(join(process.cwd(), "src", "assistant", "index.ts")) ||
    existsSync(join(process.cwd(), "src", "assistant", "index.tsx")) ||
    existsSync(join(process.cwd(), "src", "assistant", "index.js"))
  );
}

function hasUltraplanCommandModule(): boolean {
  return hasCommandModule("ultraplan");
}

function hasCoordinatorModule(): boolean {
  return (
    existsSync(
      join(process.cwd(), "src", "coordinator", "coordinatorMode.ts"),
    ) ||
    existsSync(
      join(process.cwd(), "src", "coordinator", "coordinatorMode.tsx"),
    ) ||
    existsSync(join(process.cwd(), "src", "coordinator", "coordinatorMode.js"))
  );
}

function hasCommandModule(relativePath: string): boolean {
  const noIndexPath = relativePath.replace(/\/index$/u, "");
  return (
    existsSync(join(process.cwd(), "src", "commands", `${relativePath}.ts`)) ||
    existsSync(join(process.cwd(), "src", "commands", `${relativePath}.tsx`)) ||
    existsSync(join(process.cwd(), "src", "commands", `${relativePath}.js`)) ||
    existsSync(
      join(process.cwd(), "src", "commands", noIndexPath, "index.ts"),
    ) ||
    existsSync(
      join(process.cwd(), "src", "commands", noIndexPath, "index.tsx"),
    ) ||
    existsSync(join(process.cwd(), "src", "commands", noIndexPath, "index.js"))
  );
}

function getFeatureAvailability(): FeatureAvailability {
  return {
    buddy: hasBuddyCommandModule(),
    proactive: hasProactiveCommandModule(),
    bridge: hasBridgeCommandModule(),
    voice: hasVoiceCommandModule(),
    kairos: hasKairosModule(),
    ultraplan: hasUltraplanCommandModule(),
    coordinator: hasCoordinatorModule(),
  };
}

function openBrowser(url: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      detached: true,
    }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function getProjectLinks(): ProjectLinks {
  return {
    repoUrl: MAINTAINER_GITHUB_REPO,
    issuesUrl: `${MAINTAINER_GITHUB_REPO}/issues`,
    pullsUrl: `${MAINTAINER_GITHUB_REPO}/pulls`,
  };
}

function getBrandLogoSrc(): string | undefined {
  if (existsSync(LOGO_PATH)) {
    return "/assets/logo.jpg";
  }
  if (existsSync(FALLBACK_LOGO_PATH)) {
    return "/assets/preview.png";
  }
  return undefined;
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function launchCli(config: LauncherConfig): void {
  const env = getRuntimeEnv(config);
  const args = ["run", "./src/dev-entry.ts", "--bare"];
  if (config.dangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions");
  }
  if (config.model.trim()) {
    args.push("--model", config.model.trim());
  }

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", "cmd", "/k", "bun", ...args], {
      cwd: process.cwd(),
      env,
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }

  if (process.platform === "darwin") {
    // Only export env vars that differ from the inherited environment,
    // focusing on Claude-related keys to avoid leaking the entire env
    // into Terminal command history and hitting osascript length limits.
    const relevantPrefixes = [
      "ANTHROPIC_",
      "CLAUDE_",
      "XAI_",
      "NO_COLOR",
    ];
    const envDiff = Object.entries(env).filter(([k, v]) => {
      if (v === undefined) return false;
      if (process.env[k] === v) return false;
      return relevantPrefixes.some((p) => k.startsWith(p)) || k === "NO_COLOR";
    });
    const envPairs = envDiff
      .map(([k, v]) => `export ${k}=${shellEscape(v!)}`)
      .join("; ");
    const bunCmd = `cd ${shellEscape(process.cwd())} && ${envPairs ? envPairs + " && " : ""}bun ${args.join(" ")}`;
    const script = `tell application "Terminal"
  activate
  do script ${JSON.stringify(bunCmd)}
end tell`;
    spawn("osascript", ["-e", script], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }

  // Linux: try to open a visible terminal window, similar to Windows/macOS.
  const terminal = findLinuxTerminal();
  if (terminal) {
    const relevantPrefixes = [
      "ANTHROPIC_",
      "CLAUDE_",
      "XAI_",
      "NO_COLOR",
    ];
    const envDiff = Object.entries(env).filter(([k, v]) => {
      if (v === undefined) return false;
      if (process.env[k] === v) return false;
      return relevantPrefixes.some((p) => k.startsWith(p)) || k === "NO_COLOR";
    });
    const envPairs = envDiff
      .map(([k, v]) => `export ${k}=${shellEscape(v!)}`)
      .join("; ");
    const bunCmd = `cd ${shellEscape(process.cwd())} && ${envPairs ? envPairs + " && " : ""}bun ${args.join(" ")}; exec bash`;

    const termArgs: string[] =
      terminal === "gnome-terminal"
        ? ["--", "bash", "-c", bunCmd]
        : ["-e", "bash", "-c", bunCmd];

    spawn(terminal, termArgs, {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    // Fallback: no terminal emulator found, run in background.
    spawn("bun", args, {
      cwd: process.cwd(),
      env,
      detached: true,
      stdio: "ignore",
    }).unref();
  }
}

function html(
  config: LauncherConfig,
  links: ProjectLinks,
  logoSrc?: string,
  featureAvailability: FeatureAvailability = {
    buddy: true,
    proactive: true,
    bridge: true,
    voice: true,
    kairos: true,
    ultraplan: true,
    coordinator: true,
  },
): string {
  const providerHint = {
    xai: "xAI 网关（推荐：无需手改命令）",
    anthropic: "Anthropic 官方 API",
    openrouter: "OpenRouter Anthropic 兼容网关",
    custom: "第三方自定义（可选 Anthropic/OpenAI 模式）",
    other: "其他第三方（可选 Anthropic/OpenAI 模式）",
    glm: "GLM（需填写兼容网关 API 地址）",
    deepseek: "DeepSeek（推荐模型：deepseek-chat / deepseek-reasoner）",
    qwen: "Qwen/通义（需填写兼容网关 API 地址）",
    kimi: "Kimi（月之暗面，需填写兼容网关 API 地址）",
    bedrock: "AWS Bedrock（使用本机 AWS 凭证）",
    vertex: "Google Vertex（使用本机 GCP 凭证）",
    foundry: "Azure Foundry（API Key + Base URL）",
  }[config.provider];

  const linksHtml = `<a href="${links.repoUrl}" target="_blank" rel="noreferrer">项目主页</a>
       <span>·</span>
       <a href="${links.issuesUrl}" target="_blank" rel="noreferrer">Issues</a>
       <span>·</span>
       <a href="${links.pullsUrl}" target="_blank" rel="noreferrer">Pull Requests</a>`;

  const logoHtml = logoSrc
    ? `<div class="logo-wrap"><img src="${logoSrc}" alt="码上全栈创享家" class="logo" /></div>`
    : "";

  const faviconSrc = logoSrc || "/assets/preview.png";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Claude 一键启动面板</title>
  <link rel="icon" href="${faviconSrc}" />
  <link rel="shortcut icon" href="${faviconSrc}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-1: #071a26;
      --bg-2: #103247;
      --card: rgba(7, 23, 36, 0.78);
      --text: #eaf7f8;
      --muted: #a8c2cc;
      --accent: #49d8b0;
      --accent-strong: #1eac87;
      --danger: #ff7b74;
      --line: rgba(147, 206, 220, 0.24);
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Sans SC", "PingFang SC", sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 700px at -10% -20%, #1b4659 0%, transparent 66%),
        radial-gradient(900px 540px at 112% 8%, #2f5032 0%, transparent 65%),
        linear-gradient(145deg, var(--bg-1), var(--bg-2));
      width: 100vw;
      min-height: 100dvh;
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }
    body::before,
    body::after {
      content: "";
      position: absolute;
      border-radius: 999px;
      filter: blur(60px);
      pointer-events: none;
      opacity: 0.42;
    }
    body::before {
      width: 380px;
      height: 380px;
      background: #16c79a;
      top: -120px;
      right: -90px;
      animation: floatOrbA 12s ease-in-out infinite;
    }
    body::after {
      width: 300px;
      height: 300px;
      background: #3278b8;
      bottom: -80px;
      left: -70px;
      animation: floatOrbB 14s ease-in-out infinite;
    }
    .panel {
      width: min(860px, 100%);
      max-height: calc(100dvh - 32px);
      background: linear-gradient(155deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03));
      border: 1px solid var(--line);
      border-radius: 24px;
      backdrop-filter: blur(11px);
      box-shadow: var(--shadow);
      padding: 22px 22px 16px;
      position: relative;
      z-index: 2;
      animation: cardEnter .55s cubic-bezier(.22,.61,.36,1) both;
      overflow: hidden;
    }
    .panel::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.08);
      pointer-events: none;
    }
    .logo-wrap {
      display: flex;
      justify-content: center;
      margin-bottom: 8px;
    }
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      object-fit: cover;
      box-shadow: 0 14px 30px rgba(0,0,0,0.32);
      border: 1px solid rgba(255,255,255,0.28);
      animation: logoPop .62s cubic-bezier(.2,.9,.2,1) .12s both;
    }
    h1 {
      margin: 0;
      font-family: "Space Grotesk", "Noto Sans SC", sans-serif;
      font-size: clamp(26px, 4.2vw, 34px);
      line-height: 1.04;
      letter-spacing: 0.2px;
      text-align: center;
    }
    .eyebrow {
      text-align: center;
      color: #9fd6c4;
      font-size: 12px;
      letter-spacing: 1.6px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .subtitle {
      color: var(--muted);
      margin: 8px auto 12px;
      max-width: 640px;
      text-align: center;
      line-height: 1.45;
      font-size: 13px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 auto 10px;
      padding: 6px 12px;
      border: 1px solid rgba(98, 198, 166, 0.38);
      background: rgba(21, 79, 73, 0.3);
      border-radius: 999px;
      font-size: 12px;
      color: #bdf2de;
    }
    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      margin-bottom: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: rgba(2, 11, 20, 0.25);
      border: 1px solid rgba(163, 220, 206, 0.1);
      border-radius: 15px;
      padding: 12px;
    }
    .full { grid-column: 1 / -1; }
    label {
      display: block;
      margin-bottom: 5px;
      font-size: 11px;
      letter-spacing: 0.3px;
      color: #a2bec4;
    }
    input, select {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(10, 26, 40, 0.86);
      color: var(--text);
      padding: 9px 11px;
      font-size: 13px;
      transition: border-color .2s ease, box-shadow .2s ease;
    }
    input:focus, select:focus {
      outline: none;
      border-color: rgba(66, 215, 166, 0.9);
      box-shadow: 0 0 0 3px rgba(66, 215, 166, 0.16);
    }
    .row {
      display: flex;
      gap: 12px;
      margin-top: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: transform .14s ease, box-shadow .2s ease, opacity .2s ease;
      font-family: "Space Grotesk", "Noto Sans SC", sans-serif;
      min-width: 138px;
    }
    button:hover {
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(1px);
    }
    .primary {
      background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      color: #022f25;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(24, 178, 131, 0.35);
    }
    .ghost {
      background: rgba(255,255,255,0.03);
      color: var(--text);
      border: 1px solid rgba(155, 194, 205, 0.35);
    }
    .danger {
      background: rgba(255, 119, 111, 0.18);
      color: #ffd0cb;
      border: 1px solid rgba(255, 136, 129, 0.55);
      font-weight: 700;
    }
    .hint {
      margin-top: 14px;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }
    .devbox {
      margin-top: 12px;
      border: 1px dashed rgba(160, 211, 198, 0.34);
      border-radius: 14px;
      padding: 10px;
      background: rgba(7, 19, 31, 0.45);
    }
    .switches {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
      margin-top: 8px;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
      font-size: 12px;
    }
    .switch.disabled {
      opacity: .58;
    }
    .tag {
      font-size: 11px;
      border-radius: 999px;
      padding: 1px 8px;
      border: 1px solid rgba(255, 183, 121, 0.5);
      background: rgba(118, 73, 25, 0.35);
      color: #ffd4a7;
    }
    .switch input { width: auto; }
    .status {
      margin-top: 12px;
      min-height: 20px;
      font-size: 13px;
      text-align: center;
    }
    .ok { color: #55efc4; }
    .err { color: #ffb8b8; }
    .warn { color: #ffd4a7; }
    .footer {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
      line-height: 1.55;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
      align-items: center;
    }
    .footer .links {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .footer a {
      color: #8bd8ff;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    @keyframes cardEnter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(.99);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes logoPop {
      from {
        opacity: 0;
        transform: scale(.82);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes floatOrbA {
      0%, 100% { transform: translateY(0) translateX(0); }
      50% { transform: translateY(20px) translateX(-8px); }
    }
    @keyframes floatOrbB {
      0%, 100% { transform: translateY(0) translateX(0); }
      50% { transform: translateY(-15px) translateX(10px); }
    }
    @media (max-width: 700px) {
      body { padding: 10px; }
      .panel {
        max-height: calc(100dvh - 20px);
        padding: 14px 14px 12px;
        border-radius: 18px;
      }
      h1 { font-size: 25px; }
      .subtitle { margin-bottom: 8px; font-size: 12px; }
      .grid { grid-template-columns: 1fr; }
      .switches { grid-template-columns: 1fr; }
      button { min-width: 110px; }
      .footer { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main class="panel">
    ${logoHtml}
    <section class="hero">
      <div class="eyebrow">CLAUDE LAUNCH CONTROL</div>
      <h1>一键启动面板</h1>
      <div class="pill">当前推荐：<span id="providerHintText">${providerHint}</span></div>
      <div class="subtitle">给普通用户的最短路径：填好配置，点击保存并启动 Claude。支持第三方网关和功能白名单。</div>
    </section>

    <div class="grid">
      <div>
        <label>Provider</label>
        <select id="provider">
          <option value="xai">xAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="openrouter">OpenRouter</option>
          <option value="custom">Custom</option>
          <option value="other">Other（其他第三方）</option>
          <option value="glm">GLM</option>
          <option value="deepseek">DeepSeek</option>
          <option value="qwen">Qwen</option>
          <option value="kimi">Kimi</option>
          <option value="bedrock">AWS Bedrock</option>
          <option value="vertex">Google Vertex</option>
          <option value="foundry">Azure Foundry</option>
        </select>
      </div>
      <div>
        <label>Model</label>
        <input id="model" placeholder="grok-4.20-0309-reasoning" />
      </div>
      <div>
        <label>第三方协议模式</label>
        <select id="protocolMode">
          <option value="anthropic">Anthropic（/v1/messages）</option>
          <option value="openai">OpenAI（自动尝试转换到 /anthropic）</option>
        </select>
      </div>
      <div>
        <label>Theme</label>
        <select id="theme">
          <option value="auto">Auto（跟随系统）</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="dark-daltonized">Dark Daltonized</option>
          <option value="light-daltonized">Light Daltonized</option>
          <option value="dark-ansi">Dark ANSI</option>
          <option value="light-ansi">Light ANSI</option>
        </select>
      </div>
      <div>
        <label>主色调（命令行品牌色）</label>
        <select id="accentColor">
          <option value="default">默认（系统内置）</option>
          <option value="orange">橙色</option>
          <option value="green">绿色</option>
          <option value="blue">蓝色</option>
          <option value="purple">紫色</option>
          <option value="pink">粉色</option>
          <option value="cyan">青色</option>
        </select>
      </div>
      <div class="full">
        <label>API Key</label>
        <input id="apiKey" type="password" placeholder="填这里，例如 xai-..." />
      </div>
      <div class="full" id="vertexWrap">
        <label>Vertex Project ID（仅 vertex 用）</label>
        <input id="vertexProjectId" placeholder="your-gcp-project-id" />
      </div>
      <div class="full" id="foundryKeyWrap">
        <label>Foundry API Key（仅 foundry 用）</label>
        <input id="foundryApiKey" type="password" placeholder="填 Azure Foundry key" />
      </div>
      <div class="full" id="foundryBaseWrap">
        <label>Foundry Base URL（仅 foundry 用）</label>
        <input id="foundryBaseUrl" placeholder="https://your-resource.services.ai.azure.com" />
      </div>
      <div class="full" id="baseWrap">
        <label>API 地址 / Base URL（第三方必填）</label>
        <input id="baseUrl" placeholder="https://your-provider.example.com" />
      </div>
    </div>

    <div class="devbox">
      <label class="switch"><input type="checkbox" id="developerMode" /> 开发者模式（允许按白名单解锁被门控功能）</label>
      <label class="switch" style="margin-top:8px; display:inline-flex;"><input type="checkbox" id="dangerouslySkipPermissions" /> ⚠️ 全程跳过安全确认（一键大权限跑代码，推荐）</label>
      <div class="switches" id="devSwitches">
        <label class="switch" id="buddySwitch"><input type="checkbox" id="enableBuddy" /> Buddy 宠物 <span id="buddyTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="proactiveSwitch"><input type="checkbox" id="enableProactive" /> Proactive 主动模式 <span id="proactiveTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="bridgeSwitch"><input type="checkbox" id="enableBridge" /> Bridge 远程桥接 <span id="bridgeTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="voiceSwitch"><input type="checkbox" id="enableVoice" /> Voice 语音模式 <span id="voiceTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="kairosSwitch"><input type="checkbox" id="enableKairos" /> Kairos 助手模式 <span id="kairosTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="ultraplanSwitch"><input type="checkbox" id="enableUltraplan" /> Ultraplan 云端深度规划 <span id="ultraplanTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="coordinatorSwitch"><input type="checkbox" id="enableCoordinator" /> Coordinator 多 Agent 编排 <span id="coordinatorTag" class="tag" style="display:none;">未安装</span></label>
      </div>
    </div>

    <div class="row">
      <button class="primary" id="saveBtn">保存配置</button>
      <button class="ghost" id="launchBtn">保存并启动 Claude</button>
      <button class="danger" id="quitBtn">关闭面板</button>
    </div>

    <div class="hint">配置会保存在项目根目录 .launcher-config.json。仅本地使用，不会自动上传。</div>
    <div id="updateBanner" style="display:none; margin: 10px 0; padding: 12px; background: rgba(30, 215, 96, 0.1); border: 1px solid var(--theme-text-ok); color: var(--theme-text-ok); border-radius: 8px; font-weight: bold; cursor: pointer;" title="点击立刻自动更新" onclick="triggerAutoUpdate()">
      ✨ 发现项目新版本！点击这里自动拉取更新 (git pull)
    </div>
    <div class="status" id="status"></div>

    <div class="footer">
      <div>开源项目维护：${MAINTAINER_NAME}</div>
      <div class="links">${linksHtml}</div>
    </div>
  </main>

  <script>
    const initial = ${JSON.stringify(config).replace(/</g, "\\u003c")}
    const featureAvailability = ${JSON.stringify(featureAvailability).replace(/</g, "\\u003c")}
    const provider = document.getElementById('provider')
    const model = document.getElementById('model')
    const protocolMode = document.getElementById('protocolMode')
    const theme = document.getElementById('theme')
    const accentColor = document.getElementById('accentColor')
    const apiKey = document.getElementById('apiKey')
    const baseUrl = document.getElementById('baseUrl')
    const vertexProjectId = document.getElementById('vertexProjectId')
    const foundryApiKey = document.getElementById('foundryApiKey')
    const foundryBaseUrl = document.getElementById('foundryBaseUrl')
    const developerMode = document.getElementById('developerMode')
    const dangerouslySkipPermissions = document.getElementById('dangerouslySkipPermissions')
    const enableBuddy = document.getElementById('enableBuddy')
    const enableProactive = document.getElementById('enableProactive')
    const enableBridge = document.getElementById('enableBridge')
    const enableVoice = document.getElementById('enableVoice')
    const enableKairos = document.getElementById('enableKairos')
    const enableUltraplan = document.getElementById('enableUltraplan')
    const enableCoordinator = document.getElementById('enableCoordinator')
    const devSwitches = document.getElementById('devSwitches')
    const buddySwitch = document.getElementById('buddySwitch')
    const buddyTag = document.getElementById('buddyTag')
    const proactiveSwitch = document.getElementById('proactiveSwitch')
    const proactiveTag = document.getElementById('proactiveTag')
    const bridgeSwitch = document.getElementById('bridgeSwitch')
    const bridgeTag = document.getElementById('bridgeTag')
    const voiceSwitch = document.getElementById('voiceSwitch')
    const voiceTag = document.getElementById('voiceTag')
    const kairosSwitch = document.getElementById('kairosSwitch')
    const kairosTag = document.getElementById('kairosTag')
    const ultraplanSwitch = document.getElementById('ultraplanSwitch')
    const ultraplanTag = document.getElementById('ultraplanTag')
    const coordinatorSwitch = document.getElementById('coordinatorSwitch')
    const coordinatorTag = document.getElementById('coordinatorTag')
    const baseWrap = document.getElementById('baseWrap')
    const baseUrlLabel = baseWrap.querySelector('label')
    const vertexWrap = document.getElementById('vertexWrap')
    const foundryKeyWrap = document.getElementById('foundryKeyWrap')
    const foundryBaseWrap = document.getElementById('foundryBaseWrap')
    const providerHintText = document.getElementById('providerHintText')
    const status = document.getElementById('status')

    const providerHints = {
      xai: 'xAI 网关（推荐：无需手改命令）',
      anthropic: 'Anthropic 官方 API',
      openrouter: 'OpenRouter Anthropic 兼容网关',
      custom: '第三方自定义（可选 Anthropic/OpenAI 模式）',
      other: '其他第三方（可选 Anthropic/OpenAI 模式）',
      glm: 'GLM（需填写兼容网关 API 地址）',
      deepseek: 'DeepSeek（推荐模型：deepseek-chat / deepseek-reasoner）',
      qwen: 'Qwen/通义（需填写兼容网关 API 地址）',
      kimi: 'Kimi（月之暗面，需填写兼容网关 API 地址）',
      bedrock: 'AWS Bedrock（使用本机 AWS 凭证）',
      vertex: 'Google Vertex（使用本机 GCP 凭证）',
      foundry: 'Azure Foundry（API Key + Base URL）',
    }

    provider.value = initial.provider
    model.value = initial.model || ''
    protocolMode.value = initial.protocolMode || 'anthropic'
    theme.value = initial.theme || 'dark'
    accentColor.value = initial.accentColor || 'default'
    apiKey.value = initial.apiKey || ''
    baseUrl.value = initial.baseUrl || ''
    vertexProjectId.value = initial.vertexProjectId || ''
    foundryApiKey.value = initial.foundryApiKey || ''
    foundryBaseUrl.value = initial.foundryBaseUrl || ''
    developerMode.checked = !!initial.developerMode
    dangerouslySkipPermissions.checked = !!initial.dangerouslySkipPermissions
    enableBuddy.checked = !!initial.enableBuddy
    enableProactive.checked = !!initial.enableProactive
    enableBridge.checked = !!initial.enableBridge
    enableVoice.checked = !!initial.enableVoice
    enableKairos.checked = !!initial.enableKairos
    enableUltraplan.checked = !!initial.enableUltraplan
    enableCoordinator.checked = !!initial.enableCoordinator

    function applyAvailability(checkbox, wrap, tag, available) {
      if (available) return
      checkbox.checked = false
      checkbox.disabled = true
      if (wrap) wrap.classList.add('disabled')
      if (tag) tag.style.display = 'inline-flex'
    }

    applyAvailability(enableBuddy, buddySwitch, buddyTag, featureAvailability.buddy)
    applyAvailability(enableProactive, proactiveSwitch, proactiveTag, featureAvailability.proactive)
    applyAvailability(enableBridge, bridgeSwitch, bridgeTag, featureAvailability.bridge)
    applyAvailability(enableVoice, voiceSwitch, voiceTag, featureAvailability.voice)
    applyAvailability(enableKairos, kairosSwitch, kairosTag, featureAvailability.kairos)
    applyAvailability(enableUltraplan, ultraplanSwitch, ultraplanTag, featureAvailability.ultraplan)
    applyAvailability(enableCoordinator, coordinatorSwitch, coordinatorTag, featureAvailability.coordinator)

    function refreshUI() {
      const isApiKeyProvider = ['xai', 'anthropic', 'openrouter', 'custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
      const isCustom = ['custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
      const isVertex = provider.value === 'vertex'
      const isFoundry = provider.value === 'foundry'

      apiKey.parentElement.style.display = isApiKeyProvider ? 'block' : 'none'
      baseWrap.style.display = isCustom ? 'block' : 'none'
      if (providerHintText && providerHints[provider.value]) {
        const customProtocol = protocolMode.value === 'openai'
          ? 'OpenAI（自动尝试 /anthropic 转换）'
          : 'Anthropic（/v1/messages）'
        providerHintText.textContent = ['custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
          ? providerHints[provider.value] + '；当前模式：' + customProtocol
          : providerHints[provider.value]
      }
      if (isCustom && baseUrlLabel) {
        baseUrlLabel.textContent = (provider.value === 'custom' || provider.value === 'other')
          ? 'API 地址 / Base URL（第三方必填）'
          : 'API 地址 / Base URL（' + provider.value.toUpperCase() + ' 必填）'
      }
      protocolMode.parentElement.style.display = isCustom ? 'block' : 'none'
      vertexWrap.style.display = isVertex ? 'block' : 'none'
      foundryKeyWrap.style.display = isFoundry ? 'block' : 'none'
      foundryBaseWrap.style.display = isFoundry ? 'block' : 'none'
      devSwitches.style.display = developerMode.checked ? 'grid' : 'none'
    }

    provider.addEventListener('change', refreshUI)
    protocolMode.addEventListener('change', refreshUI)
    developerMode.addEventListener('change', refreshUI)
    refreshUI()

    function payload() {
      return {
        provider: provider.value,
        model: model.value,
        protocolMode: protocolMode.value,
        theme: theme.value,
        accentColor: accentColor.value,
        apiKey: apiKey.value,
        baseUrl: baseUrl.value,
        vertexProjectId: vertexProjectId.value,
        foundryApiKey: foundryApiKey.value,
        foundryBaseUrl: foundryBaseUrl.value,
        developerMode: developerMode.checked,
        dangerouslySkipPermissions: dangerouslySkipPermissions.checked,
        enableBuddy: enableBuddy.checked,
        enableProactive: enableProactive.checked,
        enableBridge: enableBridge.checked,
        enableVoice: enableVoice.checked,
        enableKairos: enableKairos.checked,
        enableUltraplan: enableUltraplan.checked,
        enableCoordinator: enableCoordinator.checked,
      }
    }

    async function post(path) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      return res.json()
    }

    function show(msg, type = 'ok') {
      status.textContent = msg
      status.className = 'status ' + type
    }

    document.getElementById('saveBtn').addEventListener('click', async () => {
      try {
        const data = await post('/api/save')
        if (!data.ok) throw new Error(data.error || '保存失败')
        if (typeof data.normalizedModel === 'string') {
          model.value = data.normalizedModel
        }
        const protocolPart = ['custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
          ? ' / protocol=' + protocolMode.value
          : ''
        const baseMsg = '保存成功：' + provider.value + protocolPart + ' / ' + (model.value || 'default-model') + ' / theme=' + theme.value + ' / accent=' + accentColor.value
        const msg = data.warning ? baseMsg + '（' + data.warning + '）' : baseMsg
        show(msg, data.warning ? 'warn' : 'ok')
      } catch (err) {
        show(err.message || String(err), 'err')
      }
    })

    document.getElementById('launchBtn').addEventListener('click', async () => {
      try {
        const data = await post('/api/launch')
        if (!data.ok) throw new Error(data.error || '启动失败')
        if (typeof data.normalizedModel === 'string') {
          model.value = data.normalizedModel
        }
        const protocolPart = ['custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
          ? ' / protocol=' + protocolMode.value
          : ''
        const baseMsg = '已启动 Claude（' + provider.value + protocolPart + ' / ' + (model.value || 'default-model') + ' / theme=' + theme.value + ' / accent=' + accentColor.value + '）'
        const msg = data.warning
          ? baseMsg + '；' + data.warning
          : baseMsg + '，请看新开的终端窗口'
        show(msg, data.warning ? 'warn' : 'ok')
      } catch (err) {
        show(err.message || String(err), 'err')
      }
    })

    document.getElementById('quitBtn').addEventListener('click', async () => {
      await fetch('/api/quit', { method: 'POST' })
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100dvh;color:#eaf7f8;font-size:18px;font-family:sans-serif;">面板已关闭，可以关闭此标签页。</div>'
      try { window.close() } catch(_) {}
    })

    async function triggerAutoUpdate() {
      show('正在自动拉取更新，请稍候不要进行其他操作...', 'warn');
      try {
        const r = await fetch('/api/auto-update', { method: 'POST' });
        const data = await r.json();
        if (data.ok) {
          alert('✅ 拉取更新成功！\\n\\n由于代码已经被覆盖，程序需要重启。请在提示结束后关闭网页，去终端窗口按 Ctrl+C，然后再重新执行 bun run launcher !');
          fetch('/api/quit', { method: 'POST' });
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100dvh;color:#eaf7f8;font-size:18px;font-family:sans-serif;">已更新完毕。请回终端重启面板。</div>';
        } else {
          show('自动拉取失败，请在终端手动执行 git pull。报错信息：' + data.error, 'err');
        }
      } catch (e) {
        show('自动拉取失败: ' + String(e), 'err');
      }
    }

    // 启动时自动检查更新
    fetch('/api/check-update').then(res => res.json()).then(data => {
      if (data.updateAvailable) {
        if (confirm('✨ 发现项目有新版本提交（修复 BUG 或 功能升级）！\\n\\n是否立即自动拉取更新 (git pull) ？')) {
          triggerAutoUpdate();
        } else {
          document.getElementById('updateBanner').style.display = 'block';
        }
      }
    }).catch(err => console.debug('Update check failed:', err));
  </script>
</body>
</html>`;
}

function validateConfig(config: LauncherConfig): string | null {
  if (requiresApiKey(config.provider) && !normalizeApiKey(config.apiKey)) {
    return "API Key 不能为空";
  }
  if (requiresBaseUrl(config.provider) && !config.baseUrl.trim()) {
    return "第三方模式必须填写 API 地址（Base URL）";
  }
  if (config.provider === "vertex" && !config.vertexProjectId.trim()) {
    return "Vertex 模式必须填写 Project ID";
  }
  if (config.provider === "foundry") {
    if (!config.foundryApiKey.trim()) {
      return "Foundry 模式必须填写 API Key";
    }
    if (!config.foundryBaseUrl.trim()) {
      return "Foundry 模式必须填写 Base URL";
    }
  }
  return null;
}

function normalizeModelForGateway(config: LauncherConfig): {
  config: LauncherConfig;
  warning?: string;
} {
  const customProviders: Provider[] = [
    "custom",
    "other",
    "glm",
    "deepseek",
    "qwen",
    "kimi",
  ];

  if (!customProviders.includes(config.provider)) {
    return { config };
  }

  const original = config.model.trim();
  if (!original) {
    if (config.provider === "deepseek") {
      return {
        config: {
          ...config,
          model: "deepseek-chat",
        },
        warning: "DeepSeek 未填写模型，已自动使用 deepseek-chat",
      };
    }
    return { config };
  }

  let normalized = original;

  // OpenAI 兼容网关常见为小写连字符模型 id。
  if (config.protocolMode === "openai") {
    normalized = normalized
      .replace(/[\s_]+/gu, "-")
      .replace(/-+/gu, "-")
      .toLowerCase();
  }

  // 常见口语/展示名 -> 网关常用模型 id 映射。
  if (config.provider === "deepseek") {
    const deepseekAliases: Record<string, string> = {
      "deepseek-v3.2": "deepseek-chat",
      "deepseek-v3-2": "deepseek-chat",
      "deepseekv3.2": "deepseek-chat",
      "deepseek-v3": "deepseek-chat",
      deepseekv3: "deepseek-chat",
      v3: "deepseek-chat",
      "deepseek-r1": "deepseek-reasoner",
      "deepseek-r1-0528": "deepseek-reasoner",
      deepseekr1: "deepseek-reasoner",
      r1: "deepseek-reasoner",
    };
    normalized = deepseekAliases[normalized] ?? normalized;
  }

  if (normalized === original) {
    return { config };
  }

  return {
    config: {
      ...config,
      model: normalized,
    },
    warning: `模型名已自动规范化：${original} -> ${normalized}`,
  };
}

function getProtocolCompatibilityWarning(
  config: LauncherConfig,
): string | undefined {
  const customProviders: Provider[] = [
    "custom",
    "other",
    "glm",
    "deepseek",
    "qwen",
    "kimi",
  ];
  if (!customProviders.includes(config.provider)) {
    return undefined;
  }

  if (!config.baseUrl.trim()) {
    return undefined;
  }

  if (config.protocolMode === "openai") {
    return "已启用 OpenAI 模式：面板会将 Base URL 自动转换为 Anthropic 兼容入口（通常是 /anthropic）。若网关不提供该入口，仍会报错，请改用 Anthropic 模式或填写网关文档中的 Anthropic 兼容地址。";
  }

  return "当前 CLI 走 Anthropic Messages 协议（/v1/messages），不是 OpenAI Chat Completions（/v1/chat/completions）。如果第三方网关只兼容 chat/completions，启动后会报 400。";
}

function mergeWarnings(
  ...warnings: Array<string | undefined>
): string | undefined {
  const merged = warnings.filter(Boolean);
  if (merged.length === 0) {
    return undefined;
  }
  return merged.join("；");
}

function normalizeUnavailableFeatureConfig(config: LauncherConfig): {
  config: LauncherConfig;
  warning?: string;
} {
  const availability = getFeatureAvailability();
  const missingLabels: string[] = [];
  let normalized = { ...config };

  if (normalized.enableBuddy && !availability.buddy) {
    normalized.enableBuddy = false;
    missingLabels.push("Buddy");
  }
  if (normalized.enableProactive && !availability.proactive) {
    normalized.enableProactive = false;
    missingLabels.push("Proactive");
  }
  if (normalized.enableBridge && !availability.bridge) {
    normalized.enableBridge = false;
    missingLabels.push("Bridge");
  }
  if (normalized.enableVoice && !availability.voice) {
    normalized.enableVoice = false;
    missingLabels.push("Voice");
  }
  if (normalized.enableKairos && !availability.kairos) {
    normalized.enableKairos = false;
    missingLabels.push("Kairos");
  }
  if (normalized.enableUltraplan && !availability.ultraplan) {
    normalized.enableUltraplan = false;
    missingLabels.push("Ultraplan");
  }
  if (normalized.enableCoordinator && !availability.coordinator) {
    normalized.enableCoordinator = false;
    missingLabels.push("Coordinator");
  }

  if (missingLabels.length > 0) {
    saveConfig(normalized);
    return {
      config: normalized,
      warning: `${missingLabels.join("/")} 模块未安装，已自动关闭对应开关`,
    };
  }

  return { config: normalized };
}

const bunRuntime = (
  globalThis as typeof globalThis & {
    Bun?: {
      serve: (options: {
        port: number;
        fetch: (request: Request) => Response | Promise<Response>;
      }) => { port: number; stop: (close?: boolean) => void };
    };
  }
).Bun;

if (!bunRuntime) {
  throw new Error("This launcher must be started with Bun runtime");
}

// Prevent multiple launcher instances from running simultaneously.
if (existsSync(LOCK_PATH)) {
  try {
    const lockData = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
    const lockPid = lockData.pid as number;
    // Check if the process is still alive.
    try {
      process.kill(lockPid, 0);
      // Process is alive — open the existing panel instead of starting a new one.
      console.log(`Launcher already running (PID ${lockPid}): ${lockData.url}`);
      openBrowser(lockData.url as string);
      process.exit(0);
    } catch {
      // Process is dead, stale lock — continue and overwrite.
    }
  } catch {
    // Corrupt lock file — continue.
  }
}

const server = bunRuntime.serve({
  port: 0,
  fetch: async (request) => {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      if (existsSync(LOGO_PATH)) {
        return new Response(readFileSync(LOGO_PATH), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (existsSync(FALLBACK_LOGO_PATH)) {
        return new Response(readFileSync(FALLBACK_LOGO_PATH), {
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "GET" && url.pathname === "/assets/logo.jpg") {
      if (!existsSync(LOGO_PATH)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(readFileSync(LOGO_PATH), {
        headers: { "content-type": "image/jpeg" },
      });
    }

    if (request.method === "GET" && url.pathname === "/assets/preview.png") {
      if (!existsSync(FALLBACK_LOGO_PATH)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(readFileSync(FALLBACK_LOGO_PATH), {
        headers: { "content-type": "image/png" },
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        html(
          loadConfig(),
          getProjectLinks(),
          getBrandLogoSrc(),
          getFeatureAvailability(),
        ),
        {
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    }

    if (request.method === "GET" && url.pathname === "/api/check-update") {
      try {
        const localHash = spawnSync("git", ["rev-parse", "HEAD"]).stdout?.toString().trim() || "";
        const res = await fetch("https://api.github.com/repos/wmuj/mashang-claude-code/commits/main", {
          headers: { "User-Agent": "mashang-claude-code-launcher" }
        });
        const data = await res.json();
        const remoteHash = data.sha;
        const updateAvailable = !!(remoteHash && localHash && remoteHash !== localHash);
        return Response.json({ updateAvailable, remoteHash, localHash });
      } catch (e) {
        return Response.json({ updateAvailable: false, error: String(e) });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/auto-update") {
      try {
        const result = spawnSync("git", ["pull"], { stdio: "pipe" });
        if (result.status !== 0) {
          return Response.json({ ok: false, error: result.stderr?.toString() });
        }
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/save") {
      if (request.headers.get("content-type") !== "application/json") {
        return new Response("Bad request", { status: 400 });
      }
      const input = (await request.json()) as Partial<LauncherConfig>;
      const savedConfig = saveConfig(input);
      applyThemeSetting(savedConfig.theme);
      const normalized = normalizeUnavailableFeatureConfig(savedConfig);
      const modelNormalized = normalizeModelForGateway(normalized.config);
      const config = modelNormalized.config;
      if (config.model !== savedConfig.model) {
        saveConfig(config);
      }
      const error = validateConfig(config);
      if (error) {
        return Response.json({ ok: false, error });
      }
      const warning = mergeWarnings(
        normalized.warning,
        modelNormalized.warning,
        getProtocolCompatibilityWarning(config),
      );
      return Response.json({
        ok: true,
        warning,
        normalizedModel: config.model,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/launch") {
      if (request.headers.get("content-type") !== "application/json") {
        return new Response("Bad request", { status: 400 });
      }
      const input = (await request.json()) as Partial<LauncherConfig>;
      const savedConfig = saveConfig(input);
      applyThemeSetting(savedConfig.theme);
      const normalized = normalizeUnavailableFeatureConfig(savedConfig);
      const modelNormalized = normalizeModelForGateway(normalized.config);
      const config = modelNormalized.config;
      if (config.model !== savedConfig.model) {
        saveConfig(config);
      }
      const error = validateConfig(config);
      if (error) {
        return Response.json({ ok: false, error });
      }
      if (!canRunBun()) {
        return Response.json({
          ok: false,
          error: "系统找不到 bun，请先安装 Bun 并重启面板",
        });
      }
      launchCli(config);
      const warning = mergeWarnings(
        normalized.warning,
        modelNormalized.warning,
        getProtocolCompatibilityWarning(config),
      );
      return Response.json({
        ok: true,
        warning,
        normalizedModel: config.model,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/quit") {
      setTimeout(() => {
        try { unlinkSync(LOCK_PATH); } catch {}
        server.stop(true);
      }, 50);
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },
});

const panelUrl = `http://127.0.0.1:${server.port}`;
writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, url: panelUrl, startedAt: new Date().toISOString() }) + "\n", "utf8");

// Clean up lock file on exit.
const cleanLock = () => { try { unlinkSync(LOCK_PATH); } catch {} };
process.on("exit", cleanLock);
process.on("SIGINT", () => { cleanLock(); process.exit(0); });
process.on("SIGTERM", () => { cleanLock(); process.exit(0); });

console.log(`Launcher panel: ${panelUrl}`);
openBrowser(panelUrl);

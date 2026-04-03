import { existsSync, readFileSync, writeFileSync } from "fs";
import { spawn, spawnSync } from "child_process";
import { join } from "path";

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

type LauncherConfig = {
  provider: Provider;
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
  model: string;
};

const CONFIG_PATH = join(process.cwd(), ".launcher-config.json");
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
};

const MAINTAINER_NAME = "码上全栈创享家";
const MAINTAINER_GITHUB_REPO =
  "https://github.com/wmuj/civil-engineering-cloud-claude-code-source-v2.1.88";
const DEFAULT_CONFIG: LauncherConfig = {
  provider: "xai",
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
  model: "grok-4.20-0309-reasoning",
};

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
    if (url.pathname === "/v1") {
      url.pathname = "";
      return url.toString().replace(/\/$/u, "");
    }
    return rawUrl.replace(/\/$/u, "");
  } catch {
    return rawUrl.trim().replace(/\/$/u, "");
  }
}

function loadConfig(): LauncherConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const text = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<LauncherConfig>;
    return {
      provider: isSupportedProvider(parsed.provider) ? parsed.provider : "xai",
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
  merged.baseUrl = normalizeBaseUrl(merged.baseUrl);
  merged.foundryBaseUrl = normalizeBaseUrl(merged.foundryBaseUrl);
  writeFileSync(CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

function clearProviderEnv(env: NodeJS.ProcessEnv): void {
  delete env.CLAUDE_CODE_USE_BEDROCK;
  delete env.CLAUDE_CODE_USE_VERTEX;
  delete env.CLAUDE_CODE_USE_FOUNDRY;
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_FOUNDRY_BASE_URL;
  delete env.ANTHROPIC_FOUNDRY_API_KEY;
}

function getRuntimeEnv(config: LauncherConfig): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.NO_COLOR = "1";
  env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1";
  clearProviderEnv(env);

  delete env.CLAUDE_CODE_DEV_FEATURES;
  delete env.CLAUDE_CODE_FORCE_ENABLE_BUDDY;
  delete env.CLAUDE_CODE_FORCE_ENABLE_PROACTIVE;
  delete env.CLAUDE_CODE_FORCE_ENABLE_BRIDGE;
  delete env.CLAUDE_CODE_FORCE_ENABLE_VOICE;

  if (config.developerMode) {
    env.CLAUDE_CODE_DEV_FEATURES = "1";
    env.CLAUDE_CODE_FORCE_ENABLE_BUDDY = config.enableBuddy ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_PROACTIVE = config.enableProactive ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_BRIDGE = config.enableBridge ? "1" : "0";
    env.CLAUDE_CODE_FORCE_ENABLE_VOICE = config.enableVoice ? "1" : "0";
  }

  if (config.provider === "anthropic") {
    env.ANTHROPIC_API_KEY = config.apiKey;
    return env;
  }

  if (config.provider === "openrouter") {
    env.ANTHROPIC_API_KEY = config.apiKey;
    env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api/anthropic";
    return env;
  }

  if (config.provider === "xai") {
    env.ANTHROPIC_API_KEY = config.apiKey;
    env.ANTHROPIC_BASE_URL = "https://api.x.ai";
    return env;
  }

  if (requiresBaseUrl(config.provider)) {
    env.ANTHROPIC_API_KEY = config.apiKey;
    env.ANTHROPIC_BASE_URL = normalizeBaseUrl(config.baseUrl);
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

function hasBuddyCommandModule(): boolean {
  return hasCommandModule("buddy/index");
}

function hasProactiveCommandModule(): boolean {
  return hasCommandModule("proactive");
}

function hasBridgeCommandModule(): boolean {
  return hasCommandModule("bridge/index");
}

function hasVoiceCommandModule(): boolean {
  return hasCommandModule("voice/index");
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

function launchCli(config: LauncherConfig): void {
  const env = getRuntimeEnv(config);
  const args = ["run", "./src/dev-entry.ts", "--bare"];
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

  spawn("bun", args, {
    cwd: process.cwd(),
    env,
    detached: true,
    stdio: "ignore",
  }).unref();
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
  },
): string {
  const providerHint = {
    xai: "xAI 网关（推荐：无需手改命令）",
    anthropic: "Anthropic 官方 API",
    openrouter: "OpenRouter Anthropic 兼容网关",
    custom: "第三方自定义（需填写 API 地址）",
    other: "其他第三方（OpenAI/Anthropic 兼容网关）",
    glm: "GLM（需填写兼容网关 API 地址）",
    deepseek: "DeepSeek（需填写兼容网关 API 地址）",
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
      <div class="switches" id="devSwitches">
        <label class="switch" id="buddySwitch"><input type="checkbox" id="enableBuddy" /> Buddy 宠物 <span id="buddyTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="proactiveSwitch"><input type="checkbox" id="enableProactive" /> Proactive 主动模式 <span id="proactiveTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="bridgeSwitch"><input type="checkbox" id="enableBridge" /> Bridge 远程桥接 <span id="bridgeTag" class="tag" style="display:none;">未安装</span></label>
        <label class="switch" id="voiceSwitch"><input type="checkbox" id="enableVoice" /> Voice 语音模式 <span id="voiceTag" class="tag" style="display:none;">未安装</span></label>
      </div>
    </div>

    <div class="row">
      <button class="primary" id="saveBtn">保存配置</button>
      <button class="ghost" id="launchBtn">保存并启动 Claude</button>
      <button class="danger" id="quitBtn">关闭面板</button>
    </div>

    <div class="hint">配置会保存在项目根目录 .launcher-config.json。仅本地使用，不会自动上传。</div>
    <div class="status" id="status"></div>

    <div class="footer">
      <div>开源项目维护：${MAINTAINER_NAME}</div>
      <div class="links">${linksHtml}</div>
    </div>
  </main>

  <script>
    const initial = ${JSON.stringify(config)}
    const featureAvailability = ${JSON.stringify(featureAvailability)}
    const provider = document.getElementById('provider')
    const model = document.getElementById('model')
    const apiKey = document.getElementById('apiKey')
    const baseUrl = document.getElementById('baseUrl')
    const vertexProjectId = document.getElementById('vertexProjectId')
    const foundryApiKey = document.getElementById('foundryApiKey')
    const foundryBaseUrl = document.getElementById('foundryBaseUrl')
    const developerMode = document.getElementById('developerMode')
    const enableBuddy = document.getElementById('enableBuddy')
    const enableProactive = document.getElementById('enableProactive')
    const enableBridge = document.getElementById('enableBridge')
    const enableVoice = document.getElementById('enableVoice')
    const devSwitches = document.getElementById('devSwitches')
    const buddySwitch = document.getElementById('buddySwitch')
    const buddyTag = document.getElementById('buddyTag')
    const proactiveSwitch = document.getElementById('proactiveSwitch')
    const proactiveTag = document.getElementById('proactiveTag')
    const bridgeSwitch = document.getElementById('bridgeSwitch')
    const bridgeTag = document.getElementById('bridgeTag')
    const voiceSwitch = document.getElementById('voiceSwitch')
    const voiceTag = document.getElementById('voiceTag')
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
      custom: '第三方自定义（需填写 API 地址）',
      other: '其他第三方（OpenAI/Anthropic 兼容网关）',
      glm: 'GLM（需填写兼容网关 API 地址）',
      deepseek: 'DeepSeek（需填写兼容网关 API 地址）',
      qwen: 'Qwen/通义（需填写兼容网关 API 地址）',
      kimi: 'Kimi（月之暗面，需填写兼容网关 API 地址）',
      bedrock: 'AWS Bedrock（使用本机 AWS 凭证）',
      vertex: 'Google Vertex（使用本机 GCP 凭证）',
      foundry: 'Azure Foundry（API Key + Base URL）',
    }

    provider.value = initial.provider
    model.value = initial.model || ''
    apiKey.value = initial.apiKey || ''
    baseUrl.value = initial.baseUrl || ''
    vertexProjectId.value = initial.vertexProjectId || ''
    foundryApiKey.value = initial.foundryApiKey || ''
    foundryBaseUrl.value = initial.foundryBaseUrl || ''
    developerMode.checked = !!initial.developerMode
    enableBuddy.checked = !!initial.enableBuddy
    enableProactive.checked = !!initial.enableProactive
    enableBridge.checked = !!initial.enableBridge
    enableVoice.checked = !!initial.enableVoice

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

    function refreshUI() {
      const isApiKeyProvider = ['xai', 'anthropic', 'openrouter', 'custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
      const isCustom = ['custom', 'other', 'glm', 'deepseek', 'qwen', 'kimi'].includes(provider.value)
      const isVertex = provider.value === 'vertex'
      const isFoundry = provider.value === 'foundry'

      apiKey.parentElement.style.display = isApiKeyProvider ? 'block' : 'none'
      baseWrap.style.display = isCustom ? 'block' : 'none'
      if (providerHintText && providerHints[provider.value]) {
        providerHintText.textContent = providerHints[provider.value]
      }
      if (isCustom && baseUrlLabel) {
        baseUrlLabel.textContent = (provider.value === 'custom' || provider.value === 'other')
          ? 'API 地址 / Base URL（第三方必填）'
          : 'API 地址 / Base URL（' + provider.value.toUpperCase() + ' 必填）'
      }
      vertexWrap.style.display = isVertex ? 'block' : 'none'
      foundryKeyWrap.style.display = isFoundry ? 'block' : 'none'
      foundryBaseWrap.style.display = isFoundry ? 'block' : 'none'
      devSwitches.style.display = developerMode.checked ? 'grid' : 'none'
    }

    provider.addEventListener('change', refreshUI)
    developerMode.addEventListener('change', refreshUI)
    refreshUI()

    function payload() {
      return {
        provider: provider.value,
        model: model.value,
        apiKey: apiKey.value,
        baseUrl: baseUrl.value,
        vertexProjectId: vertexProjectId.value,
        foundryApiKey: foundryApiKey.value,
        foundryBaseUrl: foundryBaseUrl.value,
        developerMode: developerMode.checked,
        enableBuddy: enableBuddy.checked,
        enableProactive: enableProactive.checked,
        enableBridge: enableBridge.checked,
        enableVoice: enableVoice.checked,
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
        const baseMsg = '保存成功：' + provider.value + ' / ' + (model.value || 'default-model')
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
        const baseMsg = '已启动 Claude（' + provider.value + ' / ' + (model.value || 'default-model') + '）'
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
      window.close()
    })
  </script>
</body>
</html>`;
}

function validateConfig(config: LauncherConfig): string | null {
  if (requiresApiKey(config.provider) && !config.apiKey.trim()) {
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

    if (request.method === "POST" && url.pathname === "/api/save") {
      const input = (await request.json()) as Partial<LauncherConfig>;
      const savedConfig = saveConfig(input);
      const normalized = normalizeUnavailableFeatureConfig(savedConfig);
      const config = normalized.config;
      const error = validateConfig(config);
      if (error) {
        return Response.json({ ok: false, error });
      }
      return Response.json({ ok: true, warning: normalized.warning });
    }

    if (request.method === "POST" && url.pathname === "/api/launch") {
      const input = (await request.json()) as Partial<LauncherConfig>;
      const savedConfig = saveConfig(input);
      const normalized = normalizeUnavailableFeatureConfig(savedConfig);
      const config = normalized.config;
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
      return Response.json({ ok: true, warning: normalized.warning });
    }

    if (request.method === "POST" && url.pathname === "/api/quit") {
      setTimeout(() => server.stop(true), 50);
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },
});

const panelUrl = `http://127.0.0.1:${server.port}`;
console.log(`Launcher panel: ${panelUrl}`);
openBrowser(panelUrl);

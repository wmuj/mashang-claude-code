import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const configPath = join(root, "branding.config.json");

const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const repoSlug = `${cfg.github.owner}/${cfg.github.repo}`;
const repoUrl = `https://github.com/${repoSlug}`;

function updateReadme() {
  const readmePath = join(root, "README.md");
  let text = readFileSync(readmePath, "utf8");

  text = text.replace(/^#\s+.*$/m, `# ${cfg.project.displayName}`);

  text = text.replace(
    /wmuj\/(civil-engineering-cloud-claude-code-source-v2\.1\.88|cloudforge-cli|mashang-claude-code)/g,
    repoSlug,
  );
  text = text.replace(/码上全栈创享家/g, cfg.maintainer.name);

  text = text.replace(
    /- 公众号：\*\*.*\*\*/,
    `- 公众号：**${cfg.maintainer.social.wechatOfficial}**`,
  );
  text = text.replace(
    /- 抖音：\*\*.*\*\*/,
    `- 抖音：**${cfg.maintainer.social.douyin}**`,
  );
  text = text.replace(
    /- 小红书：\*\*.*\*\*/,
    `- 小红书：**${cfg.maintainer.social.xiaohongshu}**`,
  );

  writeFileSync(readmePath, text, "utf8");
}

function updatePanel() {
  const panelPath = join(root, "src", "launcher", "panel.ts");
  let text = readFileSync(panelPath, "utf8");

  text = text.replace(
    /const MAINTAINER_NAME = ".*";/,
    `const MAINTAINER_NAME = "${cfg.maintainer.name}";`,
  );

  text = text.replace(
    /const MAINTAINER_GITHUB_REPO =\s*\n\s*".*";/,
    `const MAINTAINER_GITHUB_REPO =\n  "${repoUrl}";`,
  );

  writeFileSync(panelPath, text, "utf8");
}

function updatePackageJson() {
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  pkg.name = cfg.package.name;
  pkg.description = cfg.package.description;
  pkg.repository = {
    type: "git",
    url: `${repoUrl}.git`,
  };
  pkg.homepage = repoUrl;
  pkg.bugs = {
    url: `${repoUrl}/issues`,
  };

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

updateReadme();
updatePanel();
updatePackageJson();

console.log("Branding applied with branding.config.json");

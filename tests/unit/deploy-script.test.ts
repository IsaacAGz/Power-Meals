import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Runs the real scripts/deploy.sh against a scratch APP_ROOT. git, tar and node are real; npm, systemctl and curl
// are stubs that log their calls. A release is unhealthy when its tree has an UNHEALTHY file, and its build fails
// when the tree has FAIL_BUILD.

const DEPLOY = join(__dirname, "../../scripts/deploy.sh");
const CHECK_ENV = join(__dirname, "../../scripts/check-deploy-env.mjs");

const VALID_ENV = `DATABASE_URL=postgres://powermeals:pw@127.0.0.1:5432/powermeals
REDIS_URL=redis://:pw@127.0.0.1:6379/0
PASSWORD_PEPPER=${"x".repeat(44)}
NEXT_PUBLIC_SITE_URL=https://powermealstj.com
NEXT_PUBLIC_TURNSTILE_SITE_KEY=site
TURNSTILE_SECRET_KEY=secret
ORDER_EMAIL_FROM=pedidos@powermealstj.com
AWS_REGION=us-west-2
`;

const STUBS = {
  npm: `#!/usr/bin/env bash
echo "npm $* @ $(basename "$PWD")" >> "$STUB_LOG"
if [[ "$*" == "run build" ]]; then
  [[ -e FAIL_BUILD ]] && exit 1
  mkdir -p .next
fi
exit 0
`,
  systemctl: `#!/usr/bin/env bash
echo "systemctl $*" >> "$STUB_LOG"
`,
  curl: `#!/usr/bin/env bash
[[ -e "$APP_ROOT/current/UNHEALTHY" ]] && exit 22
exit 0
`,
};

let root: string;
let src: string;
let appRoot: string;
let systemdDir: string;
let stubLog: string;
let env: NodeJS.ProcessEnv;

function git(...args: string[]) {
  const result = spawnSync("git", args, { cwd: src, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

/** Commits the given files (null deletes) on main of the source repo and returns the sha. */
function commit(files: Record<string, string | null>) {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) rmSync(join(src, path), { force: true });
    else {
      mkdirSync(join(src, path, ".."), { recursive: true });
      writeFileSync(join(src, path), content);
    }
  }
  git("add", "-A");
  git("commit", "-q", "--allow-empty", "-m", "change");
  return git("rev-parse", "HEAD");
}

function deploy(...args: string[]) {
  const result = spawnSync("bash", [DEPLOY, ...args], { env, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

/** Deploys and fails the test with the script's output if it did not exit 0. */
function ok(...args: string[]) {
  const result = deploy(...args);
  expect(result.status, result.stderr).toBe(0);
  return result;
}

const current = () => basename(readlinkSync(join(appRoot, "current")));
const releases = () => readdirSync(join(appRoot, "releases")).sort();
const isBad = (name: string) => existsSync(join(appRoot, "releases", name, ".deploy-bad"));
const calls = () => (existsSync(stubLog) ? readFileSync(stubLog, "utf8").trim().split("\n") : []);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "deploy-test-"));
  src = join(root, "src");
  appRoot = join(root, "app");
  systemdDir = join(root, "systemd");
  stubLog = join(root, "calls.log");
  const bin = join(root, "bin");
  for (const dir of [src, join(appRoot, "shared"), systemdDir, bin]) mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  writeFileSync(join(appRoot, "shared", ".env"), VALID_ENV);
  // Installed and identical to the repo's copy, as after the first deploy.
  writeFileSync(join(systemdDir, "power-meals.service"), "v1\n");

  env = {
    NODE_ENV: "test",
    PATH: `${bin}:${process.env.PATH}`,
    HOME: root,
    APP_ROOT: appRoot,
    APP_USER: userInfo().username,
    SYSTEMD_DIR: systemdDir,
    HEALTH_TIMEOUT: "1",
    STUB_LOG: stubLog,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_CONFIG_NOSYSTEM: "1",
  };

  git("init", "-q", "-b", "main");
  mkdirSync(join(src, "scripts"));
  copyFileSync(CHECK_ENV, join(src, "scripts", "check-deploy-env.mjs"));
  commit({ "deploy/systemd/power-meals.service": "v1\n", "deploy/systemd/power-meals-backup.timer": "timer\n" });
  const mirror = spawnSync("git", ["clone", "-q", "--mirror", src, join(appRoot, "repo.git")], { env });
  expect(mirror.status).toBe(0);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("deploy.sh", () => {
  it("builds a new release, migrates, switches current and restarts", () => {
    const sha = git("rev-parse", "HEAD");
    const { status, stderr } = deploy();

    expect(status, stderr).toBe(0);
    const name = current();
    expect(name).toMatch(new RegExp(`^00001-\\d{8}T\\d{6}Z-${sha.slice(0, 7)}$`));
    const dir = join(appRoot, "releases", name);
    expect(readFileSync(join(dir, "REVISION"), "utf8").trim()).toBe(sha);
    expect(readlinkSync(join(dir, ".env"))).toBe("../../shared/.env");
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(VALID_ENV);
    expect(calls()).toEqual([
      `npm ci --no-audit --no-fund @ ${name}`,
      `npm run build @ ${name}`,
      `npm run db:migrate @ ${name}`,
      "systemctl restart power-meals",
    ]);
  });

  it("updates installed unit files and lists the ones that are not installed", () => {
    writeFileSync(join(systemdDir, "power-meals.service"), "old\n");
    const { status, stderr } = deploy();

    expect(status, stderr).toBe(0);
    expect(readFileSync(join(systemdDir, "power-meals.service"), "utf8")).toBe("v1\n");
    expect(existsSync(join(systemdDir, "power-meals-backup.timer"))).toBe(false);
    expect(stderr).toContain("not installed: power-meals-backup.timer");
    expect(calls()).toContain("systemctl daemon-reload");
  });

  it("stops before installing anything when the .env fails the check, and leaves no release behind", () => {
    writeFileSync(join(appRoot, "shared", ".env"), VALID_ENV.replace(/^PASSWORD_PEPPER=.*$/m, "PASSWORD_PEPPER=short"));
    const { status, stderr } = deploy();

    expect(status).not.toBe(0);
    expect(stderr).toContain("error: PASSWORD_PEPPER must be at least 32 characters");
    expect(calls()).toEqual([]);
    expect(releases()).toEqual([]);
    expect(existsSync(join(appRoot, "current"))).toBe(false);
  });

  it("keeps the running release when the build fails, and deletes the broken one", () => {
    ok();
    const first = current();
    commit({ FAIL_BUILD: "" });

    const { status } = deploy();
    expect(status).not.toBe(0);
    expect(current()).toBe(first);
    expect(releases()).toEqual([first]);
    expect(calls().filter((line) => line.startsWith("systemctl restart"))).toHaveLength(1);
  });

  it("rolls back on its own when the new release fails the health check", () => {
    ok();
    const first = current();
    commit({ UNHEALTHY: "" });

    const { status, stderr } = deploy();
    expect(status).not.toBe(0);
    expect(stderr).toContain("was unhealthy and is marked bad");
    expect(current()).toBe(first);
    const second = releases().find((name) => name !== first)!;
    expect(isBad(second)).toBe(true);
    expect(calls().filter((line) => line.startsWith("systemctl restart"))).toHaveLength(3);
  });

  it("rolls back to the previous good release and never back to one it left", () => {
    ok();
    const a = current();
    commit({ "b.txt": "b" });
    ok();
    const b = current();

    ok("rollback");
    expect(current()).toBe(a);
    expect(isBad(b)).toBe(true);

    commit({ "c.txt": "c" });
    ok();
    ok("rollback");
    expect(current()).toBe(a);

    expect(deploy("list").stdout).toContain(`${a} current`);
  });

  it("can roll back to a named release, and refuses when there is nothing earlier", () => {
    ok();
    const a = current();
    expect(deploy("rollback").stderr).toContain("no earlier good release");

    commit({ "b.txt": "b" });
    ok();
    ok("rollback", a);
    expect(current()).toBe(a);
  });

  it("orders releases by deploy, not by the clock", () => {
    ok();
    commit({ "b.txt": "b" });
    ok();
    expect(releases().map((name) => name.slice(0, 5))).toEqual(["00001", "00002"]);
    expect(current().startsWith("00002-")).toBe(true);
  });

  it("keeps only the newest KEEP_RELEASES releases", () => {
    env.KEEP_RELEASES = "2";
    for (const n of [1, 2, 3]) {
      commit({ [`f${n}.txt`]: String(n) });
      ok();
    }
    expect(releases()).toHaveLength(2);
    expect(releases().at(-1)).toBe(current());
  });

  it("only switches current on the first deploy, before the service is installed", () => {
    rmSync(join(systemdDir, "power-meals.service"));
    const { status, stderr } = deploy();

    expect(status, stderr).toBe(0);
    expect(stderr).toContain("power-meals.service is not installed yet");
    expect(isBad(current())).toBe(false);
    expect(calls().some((line) => line.startsWith("systemctl"))).toBe(false);
  });

  it("fails on an unknown ref without creating a release", () => {
    const { status, stderr } = deploy("no-such-branch");
    expect(status).not.toBe(0);
    expect(stderr).toContain("unknown ref: no-such-branch");
    expect(existsSync(join(appRoot, "releases"))).toBe(false);
  });
});

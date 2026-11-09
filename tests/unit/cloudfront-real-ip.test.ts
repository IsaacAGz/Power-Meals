import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { install, originFacingPrefixes, renderConf, sameRanges } from "../../scripts/cloudfront-real-ip.mjs";

const IPV4 = Array.from({ length: 12 }, (_, i) => `13.${32 + i}.0.0/16`);

function ranges(overrides: Record<string, unknown> = {}) {
  return {
    syncToken: "1700000000",
    prefixes: [
      ...IPV4.map((ip_prefix) => ({ ip_prefix, service: "CLOUDFRONT_ORIGIN_FACING" })),
      { ip_prefix: IPV4[0], service: "CLOUDFRONT_ORIGIN_FACING" },
      { ip_prefix: "52.0.0.0/8", service: "CLOUDFRONT" },
      { ip_prefix: "3.0.0.0/8", service: "EC2" },
    ],
    ipv6_prefixes: [
      { ipv6_prefix: "2600:9000:1000::/36", service: "CLOUDFRONT_ORIGIN_FACING" },
      { ipv6_prefix: "2600:1f00::/24", service: "EC2" },
    ],
    ...overrides,
  };
}

describe("originFacingPrefixes", () => {
  it("keeps only CLOUDFRONT_ORIGIN_FACING, deduplicated and sorted", () => {
    const { ipv4, ipv6 } = originFacingPrefixes(ranges());
    expect(ipv4).toEqual([...IPV4].sort());
    expect(ipv6).toEqual(["2600:9000:1000::/36"]);
  });

  it("refuses a malformed file, a bad CIDR, or a suspiciously short list", () => {
    expect(() => originFacingPrefixes({})).toThrow(/prefixes/);
    expect(() =>
      originFacingPrefixes(ranges({ prefixes: [...ranges().prefixes, { ip_prefix: "1.2.3.4; deny all", service: "CLOUDFRONT_ORIGIN_FACING" }] })),
    ).toThrow(/invalid/);
    expect(() =>
      originFacingPrefixes(ranges({ ipv6_prefixes: [{ ipv6_prefix: "10.0.0.0/8", service: "CLOUDFRONT_ORIGIN_FACING" }] })),
    ).toThrow(/invalid/);
    expect(() => originFacingPrefixes(ranges({ prefixes: ranges().prefixes.slice(0, 3) }))).toThrow(/refusing/);
  });
});

describe("renderConf / sameRanges", () => {
  it("writes one set_real_ip_from per range and ignores comment changes", () => {
    const conf = renderConf(originFacingPrefixes(ranges()), "1");
    expect(conf).toContain("set_real_ip_from 13.32.0.0/16;\n");
    expect(conf).toContain("set_real_ip_from 2600:9000:1000::/36;\n");
    expect(conf.match(/set_real_ip_from/g)).toHaveLength(13);
    expect(sameRanges(conf, renderConf(originFacingPrefixes(ranges()), "2"))).toBe(true);
    const fewer = originFacingPrefixes(ranges({ ipv6_prefixes: [] }));
    expect(sameRanges(conf, renderConf(fewer, "1"))).toBe(false);
  });
});

describe("install", () => {
  let dir: string;
  let output: string;
  let calls: string[];
  let nginxOk: boolean;
  const run = (cmd: string, args: string[]) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "nginx" && !nginxOk) throw new Error("emerg");
  };
  const conf = (token = "1", r = ranges()) => renderConf(originFacingPrefixes(r), token);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cf-real-ip-"));
    output = join(dir, "cloudfront-real-ip.conf");
    calls = [];
    nginxOk = true;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates the file on the first run without reloading", () => {
    expect(install(output, conf(), run)).toBe("created");
    expect(readFileSync(output, "utf8")).toBe(conf());
    expect(calls).toEqual(["nginx -t -q"]);
  });

  it("leaves the file alone when only the comments changed", () => {
    writeFileSync(output, conf("1"));
    expect(install(output, conf("2"), run)).toBe("unchanged");
    expect(readFileSync(output, "utf8")).toBe(conf("1"));
    expect(calls).toEqual([]);
  });

  it("replaces the file and reloads nginx when the ranges changed", () => {
    writeFileSync(output, conf("1", ranges({ ipv6_prefixes: [] })));
    expect(install(output, conf("2"), run)).toBe("updated");
    expect(readFileSync(output, "utf8")).toBe(conf("2"));
    expect(calls).toEqual(["nginx -t -q", "systemctl reload nginx"]);
    expect(existsSync(`${output}.previous`)).toBe(false);
  });

  it("restores the previous file and does not reload when nginx -t fails", () => {
    const previous = conf("1", ranges({ ipv6_prefixes: [] }));
    writeFileSync(output, previous);
    nginxOk = false;
    expect(() => install(output, conf("2"), run)).toThrow(/kept the previous/);
    expect(readFileSync(output, "utf8")).toBe(previous);
    expect(calls).toEqual(["nginx -t -q"]);
  });

  it("removes a first file that nginx rejects", () => {
    nginxOk = false;
    expect(() => install(output, conf(), run)).toThrow();
    expect(existsSync(output)).toBe(false);
  });
});

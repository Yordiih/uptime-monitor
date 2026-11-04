import { describe, expect, it } from "vitest";
import { checkUrl, isPrivateAddress } from "../src/checker";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "2606:4700:4700::1111",
  ])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("blocks anything that is not a valid IP", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("checkUrl SSRF protection", () => {
  it.each([
    ["loopback IPv4", "http://127.0.0.1:9/"],
    ["cloud metadata endpoint", "http://169.254.169.254/latest/meta-data/"],
    ["loopback IPv6", "http://[::1]/"],
    ["IPv4-mapped IPv6", "http://[::ffff:127.0.0.1]/"],
    ["decimal-encoded IP", "http://2130706433/"],
    ["hex-encoded IP", "http://0x7f000001/"],
    ["private network", "http://192.168.0.1/"],
    ["localhost by name", "http://localhost:4000/"],
  ])("blocks %s", async (_label, url) => {
    const outcome = await checkUrl(url, 200);
    expect(outcome.up).toBe(false);
    expect(outcome.error).toContain("blocked address");
  });

  it("rejects non-http protocols", async () => {
    const outcome = await checkUrl("ftp://example.com/", 200);
    expect(outcome.up).toBe(false);
    expect(outcome.error).toBe("unsupported protocol");
  });

  it("reports an invalid URL as down instead of throwing", async () => {
    const outcome = await checkUrl("not a url", 200);
    expect(outcome.up).toBe(false);
    expect(outcome.error).toBeDefined();
  });
});

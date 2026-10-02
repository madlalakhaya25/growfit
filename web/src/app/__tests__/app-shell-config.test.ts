import nextConfig from "../../../next.config";
import manifest from "../manifest";

describe("installed-app and browser-permission config", () => {
  it("opens the installed app on the dashboard, not the marketing page", () => {
    expect(manifest().start_url).toBe("/dashboard");
  });

  it("lets the app's own pages use the microphone (voice notes), and nothing else's", async () => {
    const rules = await nextConfig.headers!();
    const policy = rules.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")!.value;
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
  });
});

const { retry } = require("../lib/retry");

describe("retry", () => {
  it("retries once and returns on second attempt", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls += 1;
      if (calls < 2) throw new Error("fail");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("throws after exhausting attempts", async () => {
    let calls = 0;
    await expect(
      retry(async () => {
        calls += 1;
        throw new Error("always-fail");
      }, { attempts: 3, baseMs: 10 })
    ).rejects.toThrow("always-fail");
    expect(calls).toBe(3);
  });
});

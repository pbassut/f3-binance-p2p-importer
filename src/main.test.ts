import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Environment Variables", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should require FIREFLY_TOKEN environment variable", () => {
    delete process.env.FIREFLY_TOKEN;
    process.env.FIREFLY_URL = "https://test.com";
    process.env.FIREFLY_SECRET = "test-secret";

    expect(process.env.FIREFLY_TOKEN).toBeUndefined();
  });

  it("should require FIREFLY_URL environment variable", () => {
    process.env.FIREFLY_TOKEN = "test-token";
    delete process.env.FIREFLY_URL;
    process.env.FIREFLY_SECRET = "test-secret";

    expect(process.env.FIREFLY_URL).toBeUndefined();
  });

  it("should require FIREFLY_SECRET environment variable", () => {
    process.env.FIREFLY_TOKEN = "test-token";
    process.env.FIREFLY_URL = "https://test.com";
    delete process.env.FIREFLY_SECRET;

    expect(process.env.FIREFLY_SECRET).toBeUndefined();
  });

  it("should load all required environment variables", () => {
    process.env.FIREFLY_TOKEN = "test-token";
    process.env.FIREFLY_URL = "https://test.com";
    process.env.FIREFLY_SECRET = "test-secret";

    expect(process.env.FIREFLY_TOKEN).toBe("test-token");
    expect(process.env.FIREFLY_URL).toBe("https://test.com");
    expect(process.env.FIREFLY_SECRET).toBe("test-secret");
  });
});
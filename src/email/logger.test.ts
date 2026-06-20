import { describe, it, expect } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  it("exposes the standard pino log methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("defaults to the info level", () => {
    // LOG_LEVEL is unset in the test environment, so it falls back to "info"
    expect(logger.level).toBe(process.env.LOG_LEVEL || "info");
  });

  it("does not throw when logging messages and error objects", () => {
    expect(() => logger.info("hello")).not.toThrow();
    expect(() => logger.error({ err: new Error("boom") }, "failed")).not.toThrow();
  });
});

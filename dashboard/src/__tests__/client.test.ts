import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getFares, getIndex, getMetadata } from "../api/client";

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getIndex", () => {
  it("calls /api/v1/index with the frequency query param and the API key header", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    await getIndex({ frequency: "daily" });

    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/v1/index");
    expect(url).toContain("frequency=daily");
    expect((options.headers as Record<string, string>)["X-API-Key"]).toBeDefined();
  });

  it("returns the parsed JSON body", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    const result = await getIndex({ frequency: "daily" });

    expect(result.comparison_id).toBe("abc");
  });

  it("omits comparison_id, start, and end from the URL when they're not provided", async () => {
    mockFetchOnce({ comparison_id: "abc", frequency: "daily", series: [] });

    await getIndex({ frequency: "daily" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).not.toContain("comparison_id");
    expect(url).not.toContain("start");
    expect(url).not.toContain("end");
    expect(url).not.toContain("undefined");
  });
});

describe("getFares", () => {
  it("omits undefined filters from the query string", async () => {
    mockFetchOnce([]);

    await getFares({ origin: "DEL" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("origin=DEL");
    expect(url).not.toContain("destination");
  });
});

describe("getMetadata", () => {
  it("throws an ApiError when the response is not ok", async () => {
    mockFetchOnce({ detail: "invalid or missing API key" }, 401);

    await expect(getMetadata()).rejects.toBeInstanceOf(ApiError);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, askQuestion, getFareRecords, getFares, getIndex, getMetadata } from "../api/client";

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

  it("serializes source filters as repeated query params", async () => {
    mockFetchOnce([]);

    await getFares({ sources: ["akasaair", "other"] });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("source=akasaair");
    expect(url).toContain("source=other");
  });

  it("serializes route filters as repeated query params", async () => {
    mockFetchOnce([]);

    await getFares({ routes: ["DEL-BOM", "DEL-BLR"] });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("route=DEL-BOM");
    expect(url).toContain("route=DEL-BLR");
  });
});

describe("getFareRecords", () => {
  it("calls the raw fare-records endpoint", async () => {
    mockFetchOnce({ mean_total_fare: null, records: [] });

    await getFareRecords({ routes: ["DEL-BOM"] });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/v1/fare-records");
    expect(url).toContain("route=DEL-BOM");
  });
});

describe("getMetadata", () => {
  it("throws an ApiError when the response is not ok", async () => {
    mockFetchOnce({ detail: "invalid or missing API key" }, 401);

    await expect(getMetadata()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("askQuestion", () => {
  it("posts the question and history and returns the parsed answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "DEL-BOM's mean fare is Rs 8000.",
        tool_calls: [{ name: "get_fare_records", args: { route: ["DEL-BOM"] }, result: { mean_total_fare: 8000 } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await askQuestion("What's the DEL-BOM fare?", []);

    expect(result.answer).toBe("DEL-BOM's mean fare is Rs 8000.");
    expect(result.tool_calls[0].name).toBe("get_fare_records");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/ask");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ question: "What's the DEL-BOM fare?", history: [] });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getFareRecords, getFares, getIndex, getMapRoutes, getMetadata } from "../api/client";

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

describe("getMapRoutes", () => {
  it("calls the route CPI map endpoint with frequency and routes", async () => {
    mockFetchOnce({ snapshot_id: null, frequency: "daily", period: null, edges: [] });

    await getMapRoutes({ frequency: "daily", routes: ["DEL-BOM"] });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/v1/map/routes");
    expect(url).toContain("frequency=daily");
    expect(url).toContain("route=DEL-BOM");
  });

  it("serializes the clicked origin city for adjacent route requests", async () => {
    mockFetchOnce({ snapshot_id: null, frequency: "daily", period: null, edges: [] });

    await getMapRoutes({ frequency: "daily", originCity: "DEL" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("frequency=daily");
    expect(url).toContain("origin_city=DEL");
  });
});

describe("getMetadata", () => {
  it("throws an ApiError when the response is not ok", async () => {
    mockFetchOnce({ detail: "invalid or missing API key" }, 401);

    await expect(getMetadata()).rejects.toBeInstanceOf(ApiError);
  });
});

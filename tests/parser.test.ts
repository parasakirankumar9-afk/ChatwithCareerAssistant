import { describe, it, expect } from "vitest";
import { extractJobMeta } from "@/lib/rag/parser";

describe("extractJobMeta", () => {
  it("extracts title and company from 'at' pattern", () => {
    const text = "Software Engineer at Acme Corp\nFull time role in backend systems.";
    const { title, company } = extractJobMeta(text);
    expect(title).toBe("Software Engineer");
    expect(company).toBe("Acme Corp");
  });

  it("extracts from dash pattern", () => {
    const text = "Acme – Senior Backend Engineer\nResponsibilities include...";
    const { title, company } = extractJobMeta(text);
    // Short part (Acme) should be company
    expect(company).toBe("Acme");
    expect(title).toContain("Senior Backend Engineer");
  });

  it("falls back to first line as title when no pattern matches", () => {
    const text = "Director of Product\nYou will be responsible for setting product strategy...";
    const { title } = extractJobMeta(text);
    expect(title).toBe("Director of Product");
  });

  it("handles empty string", () => {
    const { title, company } = extractJobMeta("");
    expect(title).toBeUndefined();
    expect(company).toBeUndefined();
  });

  it("is case-insensitive for at pattern", () => {
    const text = "Data Scientist AT Stripe";
    const { title, company } = extractJobMeta(text);
    expect(title).toBe("Data Scientist");
    expect(company).toBe("Stripe");
  });
});

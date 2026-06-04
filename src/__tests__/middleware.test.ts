import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/supabase/middleware", () => ({
  updateSession: jest.fn().mockResolvedValue(NextResponse.next()),
}));

async function importProxy() {
  const mod = await import("../proxy");
  return mod.proxy;
}

describe("proxy", () => {
  it("redirects /auth/login to /login with status 307", async () => {
    const proxy = await importProxy();
    const request = new NextRequest("http://localhost/auth/login");
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});

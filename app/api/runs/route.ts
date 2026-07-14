import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { siteQaBreakpoints, siteQaRuns } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (runId) {
    const [run] = await db
      .select()
      .from(siteQaRuns)
      .where(eq(siteQaRuns.id, Number(runId)));

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const breakpoints = await db
      .select()
      .from(siteQaBreakpoints)
      .where(eq(siteQaBreakpoints.runId, run.id));

    return NextResponse.json({ run, breakpoints });
  }

  const runs = await db
    .select()
    .from(siteQaRuns)
    .orderBy(desc(siteQaRuns.createdAt));

  return NextResponse.json({ runs });
}

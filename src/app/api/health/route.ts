import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database connectivity. Point uptime monitoring at this. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("[health] database unreachable", error);
    return NextResponse.json(
      { status: "degraded", database: "down" },
      { status: 503 },
    );
  }
}

import type { NextRequest } from "next/server";
import {
  getCompetitionResultsByEvent,
  getCompetitionResultsBySwimmer,
} from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;

  const eventNum = searchParams.get("event_num");
  const swimmer = searchParams.get("swimmer");

  if (eventNum) {
    const num = parseInt(eventNum, 10);
    if (isNaN(num)) {
      return Response.json({ error: "Invalid event_num" }, { status: 400 });
    }
    const results = await getCompetitionResultsByEvent(id, num);
    return Response.json(results);
  }

  if (swimmer) {
    if (swimmer.length < 2) {
      return Response.json({ error: "Query too short" }, { status: 400 });
    }
    const results = await getCompetitionResultsBySwimmer(id, swimmer);
    return Response.json(results);
  }

  return Response.json({ error: "Provide event_num or swimmer param" }, { status: 400 });
}

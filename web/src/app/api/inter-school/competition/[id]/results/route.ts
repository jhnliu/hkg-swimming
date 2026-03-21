import type { NextRequest } from "next/server";
import {
  getHkssfCompetitionResultsByEventKey,
  getHkssfCompetitionResultsBySwimmer,
} from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;

  const gender = searchParams.get("gender");
  const ageGroup = searchParams.get("age_group");
  const distance = searchParams.get("distance");
  const stroke = searchParams.get("stroke");
  const swimmer = searchParams.get("swimmer");

  if (gender && ageGroup && distance && stroke) {
    const results = await getHkssfCompetitionResultsByEventKey(
      id, gender, ageGroup, distance, stroke
    );
    return Response.json(results);
  }

  if (swimmer) {
    if (swimmer.length < 2) {
      return Response.json({ error: "Query too short" }, { status: 400 });
    }
    const results = await getHkssfCompetitionResultsBySwimmer(id, swimmer);
    return Response.json(results);
  }

  return Response.json(
    { error: "Provide gender+age_group+distance+stroke or swimmer param" },
    { status: 400 }
  );
}

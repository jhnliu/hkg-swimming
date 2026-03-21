import { getSwimmerResultsInCompetition } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const swimmerId = searchParams.get("swimmer_id") || "";
  const competitionId = searchParams.get("competition_id") || "";
  if (!swimmerId || !competitionId) return Response.json([]);
  const results = await getSwimmerResultsInCompetition(swimmerId, competitionId);
  return Response.json(results);
}

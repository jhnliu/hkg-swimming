import { getSwimmerCompetitions } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return Response.json([]);
  const results = await getSwimmerCompetitions(id);
  return Response.json(results);
}

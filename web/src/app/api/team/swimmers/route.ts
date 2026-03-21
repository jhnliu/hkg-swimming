import { getSwimmersSummary } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const ids = body.swimmer_ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    return Response.json([]);
  }

  if (!ids.every((id: unknown) => typeof id === "string")) {
    return Response.json([]);
  }

  const swimmers = await getSwimmersSummary(ids);
  return Response.json(swimmers);
}

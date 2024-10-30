import { getTableState } from "@/app/(main)/pages/practice/settings";
import { type NextRequest, NextResponse } from "next/server";
import type { TablePurpose } from "../../(main)/pages/practice/types.ts";

export async function GET(req: NextRequest) {
  console.log("=> In getFilter");
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const purpose = searchParams.get("purpose") as TablePurpose;

  if (!userId || !purpose) {
    return NextResponse.json(
      { error: "Missing userId or purpose" },
      { status: 400 },
    );
  }

  try {
    const tableStateFromDb = await getTableState(
      Number.parseInt(userId, 10),
      "full",
      purpose,
    );

    if (tableStateFromDb) {
      const filter: string = tableStateFromDb.globalFilter;
      return NextResponse.json({ filter });
    }

    return NextResponse.json({ filter: "" });
  } catch (error) {
    console.error("Error in getFilter: ", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

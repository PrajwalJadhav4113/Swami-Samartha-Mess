import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Holiday from "@/models/Holiday";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const result = await Holiday.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Holiday deleted successfully" });
  } catch (error: any) {
    console.error("Delete Holiday API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

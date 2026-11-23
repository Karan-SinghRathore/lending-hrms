import { NextResponse } from "next/server";
import { AppError } from "@/services/viewer";

/** Wraps a route handler: AppError → clean JSON error, anything else → 500. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
}

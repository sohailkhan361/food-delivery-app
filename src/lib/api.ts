import { NextResponse } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { DomainError } from "@/lib/orders/service";
import { PricingError } from "@/lib/orders/pricing";
import { InvalidTransitionError } from "@/lib/orders/status";

/**
 * One place that turns thrown domain errors into HTTP. Route handlers stay
 * free of try/catch and every client sees the same error envelope:
 *   { error: { code, message, fields? } }
 */

export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

function fail(code: string, message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json<ApiError>({ error: { code, message, fields } }, { status });
}

export async function handle<T>(
  fn: () => Promise<T>,
  init?: { status?: number },
): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data, { status: init?.status ?? 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] ??= issue.message;
      }
      return fail("VALIDATION", "Please check the highlighted fields.", 422, fields);
    }
    if (error instanceof UnauthorizedError) return fail("UNAUTHORIZED", error.message, 401);
    if (error instanceof ForbiddenError) return fail("FORBIDDEN", error.message, 403);
    if (error instanceof DomainError) return fail(error.code, error.message, error.status);
    if (error instanceof InvalidTransitionError) return fail("INVALID_TRANSITION", error.message, 409);
    if (error instanceof PricingError) return fail("PRICING", error.message, 400);

    // Anything unrecognised is a bug: log it, tell the user nothing useful.
    console.error("[api] unhandled", error);
    return fail("INTERNAL", "Something went wrong on our side.", 500);
  }
}

export async function parseBody<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new DomainError("Request body must be valid JSON", 400, "BAD_JSON");
  }
  return schema.parse(json);
}

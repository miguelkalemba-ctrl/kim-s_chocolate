import { NextRequest } from "next/server";

export function getSessionUser(request: NextRequest): string | null {
  const headerUser = request.headers.get("x-session-user")?.trim();
  if (headerUser) return headerUser;

  const bearer = request.headers.get("authorization")?.trim();
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice(7).trim();
    if (token) return token;
  }

  return null;
}

export function requireSessionUser(request: NextRequest): string {
  const user = getSessionUser(request);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

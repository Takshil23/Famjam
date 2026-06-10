import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { users, authSessions } from "../../db/schema.js";
import { eq, and, gt } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let token: string, firstName: string, surname: string, phone: string | undefined;
  try {
    const body = await req.json();
    token = body.token;
    firstName = body.firstName?.trim();
    surname = body.surname?.trim();
    phone = body.phone?.trim() || undefined;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!token || !firstName || !surname) {
    return Response.json(
      { error: "Token, first name, and surname are required" },
      { status: 400 }
    );
  }

  const now = new Date();

  // Validate the session token
  const [session] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.token, token), gt(authSessions.expiresAt, now)));

  if (!session) {
    return Response.json(
      { error: "Invalid or expired session. Please log in again." },
      { status: 401 }
    );
  }

  // Update the user's profile
  const [updatedUser] = await db
    .update(users)
    .set({ firstName, surname, phone: phone || null })
    .where(eq(users.id, session.userId))
    .returning();

  return Response.json({ success: true, user: updatedUser });
};

export const config: Config = {
  path: "/api/auth/save-profile",
  method: "POST",
};

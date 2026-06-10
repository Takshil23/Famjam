import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { otpSessions, users, authSessions } from "../../db/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let email: string, otp: string;
  try {
    const body = await req.json();
    email = body.email;
    otp = String(body.otp);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !otp) {
    return Response.json({ error: "Email and OTP are required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otpHash = createHash("sha256").update(otp.trim()).digest("hex");
  const now = new Date();

  // Look up a matching, unexpired OTP
  const [session] = await db
    .select()
    .from(otpSessions)
    .where(
      and(
        eq(otpSessions.email, normalizedEmail),
        eq(otpSessions.otpHash, otpHash),
        gt(otpSessions.expiresAt, now)
      )
    );

  if (!session) {
    return Response.json(
      { error: "Invalid or expired OTP. Please request a new one." },
      { status: 401 }
    );
  }

  // Consume the OTP — single use only
  await db.delete(otpSessions).where(eq(otpSessions.id, session.id));

  // Find or create the user record
  let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  const isNewUser = !user;

  if (!user) {
    [user] = await db.insert(users).values({ email: normalizedEmail }).returning();
  }

  // Issue a 30-day session token
  const token = randomBytes(32).toString("hex");
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(authSessions).values({
    userId: user.id,
    token,
    expiresAt: sessionExpiry,
  });

  return Response.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      surname: user.surname,
      phone: user.phone,
    },
    isNewUser,
  });
};

export const config: Config = {
  path: "/api/auth/verify-otp",
  method: "POST",
};

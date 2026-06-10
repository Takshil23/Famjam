import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { otpSessions } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { createHash, randomInt } from "crypto";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let email: string;
  try {
    const body = await req.json();
    email = body.email;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Generate a random 6-digit OTP
  const otp = String(randomInt(100000, 999999));
  const otpHash = createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Replace any existing OTP for this email
  await db.delete(otpSessions).where(eq(otpSessions.email, normalizedEmail));
  await db.insert(otpSessions).values({ email: normalizedEmail, otpHash, expiresAt });

  // Demo mode: return OTP in response when no email provider is configured.
  // Set SEND_REAL_EMAIL=true and add your email provider logic below for production.
  const isDemoMode = !Netlify.env.get("SEND_REAL_EMAIL");

  if (!isDemoMode) {
    // TODO: integrate an email provider (e.g. SendGrid, Mailgun, Resend)
    // const apiKey = Netlify.env.get("EMAIL_API_KEY");
    // await sendOtpEmail({ to: normalizedEmail, otp, apiKey });
  }

  return Response.json({
    success: true,
    message: isDemoMode
      ? "OTP generated — see response for demo value"
      : "OTP sent to your email address",
    ...(isDemoMode && { otp, demoMode: true }),
  });
};

export const config: Config = {
  path: "/api/auth/send-otp",
  method: "POST",
};

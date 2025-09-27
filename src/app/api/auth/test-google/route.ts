import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    config: {
      googleClientId: process.env.GOOGLE_CLIENT_ID ? "✓ Present" : "✗ Missing",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? "✓ Present" : "✗ Missing",
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? "✓ Present" : "✗ Missing",
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
      nodeEnv: process.env.NODE_ENV,
    },
    message: "Google OAuth Configuration Check"
  });
}
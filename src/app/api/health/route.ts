// src/app/api/health/route.ts — Health check para deploy
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    game: 'Flash Click Arena',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

import { revalidate } from '@/lib/shopify';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return revalidate(req);
}

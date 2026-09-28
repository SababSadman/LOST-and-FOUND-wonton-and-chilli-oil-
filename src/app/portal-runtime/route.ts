import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PORTAL_ENHANCEMENT_SCRIPT,
  PORTAL_ENHANCEMENT_STYLES,
} from '@/lib/portalEnhancements';
import { buildSupabaseInjection } from '@/lib/portalSupabaseBridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function injectBeforeLast(source: string, marker: string, injection: string) {
  const markerIndex = source.toLowerCase().lastIndexOf(marker.toLowerCase());
  if (markerIndex < 0) return source + injection;
  return source.slice(0, markerIndex) + injection + source.slice(markerIndex);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

export async function GET() {
  try {
    // Use __dirname relative to project root: src/app/portal-runtime -> ../../ -> root
    const projectRoot = join(fileURLToPath(new URL('../../..', import.meta.url)));
    const sourcePath = join(projectRoot, 'UIU-Lost-and-Found-standalone-fixed.html');
    const source = await readFile(sourcePath, 'utf8');
    const withStyles = injectBeforeLast(
      source,
      '</head>',
      PORTAL_ENHANCEMENT_STYLES,
    );
    const withSupabase = injectBeforeLast(
      withStyles,
      '</body>',
      buildSupabaseInjection(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      ),
    );
    const enhanced = injectBeforeLast(
      withSupabase,
      '</body>',
      PORTAL_ENHANCEMENT_SCRIPT,
    );

    return new Response(enhanced, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown source error';
    return new Response(
      '<!doctype html><html><body><h1>Portal source unavailable</h1><pre>' +
        escapeHtml(message) +
        '</pre></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

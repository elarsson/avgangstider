#!/usr/bin/env node
/**
 * Fetches Västtrafik line colors from Planera Resa API v4 and saves to public/vasttrafik-colors.json.
 *
 * Usage:
 *   node scripts/fetch-vasttrafik-colors.mjs <client_id> <client_secret>
 *
 * Get credentials at: https://developer.vasttrafik.se/
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN_URL = 'https://ext-api.vasttrafik.se/token';
const API_BASE = 'https://ext-api.vasttrafik.se/pr/v4';

// Known stop area GIDs (Göteborg city)
const KNOWN_GIDS = [
  '9021014001760000', // Brunnsparken, Göteborg
  '9021014003980000', // Korsvägen, Göteborg
  '9021014004490000', // Järntorget, Göteborg
  '9021014006000000', // Nils Ericson-terminalen, Göteborg
  '9021014007171000', // Hjalmar Brantingsplatsen, Göteborg
  '9021014004945000', // Lindholmen, Göteborg
  '9021014005115000', // Marklandsgatan, Göteborg
];

// Station names to resolve via the locations API
const STOP_NAMES_TO_RESOLVE = [
  'Lidköping station',
  'Skövde resecentrum',
  'Ulricehamn busstation',
  'Borås resecentrum',
  'Kampenhof resecentrum',
  'Trollhättan resecentrum',
  'Tuvesvik terminal',
  'Alingsåsterminalen',
  'Kungsbacka resecentrum',
  'Kungälv resecentrum',
  'Landvetter resecentrum',
  'Mölndal resecentrum',
  'Mölnlycketerminalen',
  'Partille bussterminal',
  'Älvängen resecentrum',
  'Amhult resecentrum',
  'Frölunda resecentrum',
  'Heden bussterminal',
];

async function getToken(clientId, clientSecret) {
  console.log(`POST ${TOKEN_URL}`);

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await res.text();
  console.log(`  → ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.log('  Response body:', text.slice(0, 400));
    throw new Error(`Token request failed (${res.status}). Check credentials and that the app is subscribed to Planera Resa v4 at developer.vasttrafik.se`);
  }

  const data = JSON.parse(text);
  console.log('  Token type:', data.token_type, '| Expires in:', data.expires_in, 's');
  return data.access_token;
}

async function resolveStopName(token, name) {
  const url = `${API_BASE}/locations/by-text?q=${encodeURIComponent(name)}&types=stoparea&limit=1`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`  Location lookup failed for "${name}" (${res.status})`);
    return null;
  }

  const data = await res.json();
  const result = data.results?.[0];
  if (!result?.gid) {
    console.warn(`  No result found for "${name}"`);
    return null;
  }

  console.log(`  "${name}" → ${result.gid} (${result.name})`);
  return result.gid;
}

async function fetchDepartures(token, stopAreaGid) {
  const url = `${API_BASE}/stop-areas/${stopAreaGid}/departures?limit=100&timeSpanInMinutes=60`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`  Departures failed (${res.status}): ${body.slice(0, 200)}`);
    return [];
  }

  const data = await res.json();
  return data.results ?? [];
}

async function main() {
  const [, , clientId, clientSecret] = process.argv;

  if (!clientId || !clientSecret) {
    console.error('Usage: node scripts/fetch-vasttrafik-colors.mjs <client_id> <client_secret>');
    process.exit(1);
  }

  console.log('Authenticating…');
  const token = await getToken(clientId, clientSecret);
  console.log('Token acquired.\n');

  // Resolve station names to GIDs
  console.log('Resolving station names…');
  const resolvedGids = [];
  for (const name of STOP_NAMES_TO_RESOLVE) {
    const gid = await resolveStopName(token, name);
    if (gid) resolvedGids.push(gid);
  }

  const allGids = [...new Set([...KNOWN_GIDS, ...resolvedGids])];
  console.log(`\nSampling ${allGids.length} stops total.\n`);

  const colors = {};

  for (const gid of allGids) {
    console.log(`Fetching departures for stop ${gid}…`);
    const departures = await fetchDepartures(token, gid);
    console.log(`  ${departures.length} departures`);

    for (const dep of departures) {
      const line = dep.serviceJourney?.line;
      if (!line?.designation) continue;

      const { designation, backgroundColor, foregroundColor, borderColor } = line;
      if (colors[designation]) continue;

      if (backgroundColor || foregroundColor || borderColor) {
        colors[designation] = {
          ...(backgroundColor && { backgroundColor }),
          ...(foregroundColor && { foregroundColor }),
          ...(borderColor && { borderColor }),
        };
      }
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(colors).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  );

  const outPath = join(__dirname, '..', 'public', 'vasttrafik-colors.json');
  writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n');

  console.log(`\nSaved ${Object.keys(sorted).length} line colors to public/vasttrafik-colors.json`);
  console.log('Lines found:', Object.keys(sorted).join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

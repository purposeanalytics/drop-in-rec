'use strict';
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://recfinderto.ca';
const DIST_DIR = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(DIST_DIR)) {
  console.error('dist/ not found — run npm run build first.');
  process.exit(1);
}

const dropIns = require('../public/Drop-in.json');
const locations = require('../public/Locations.json');

const now = new Date();
const todayStr = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

// Subcategories matching categories.ts
const subcategories = [
  ['arts-crafts', ['visual-arts', 'crafts', 'music', 'dance', 'creative-writing']],
  ['family', ['family-swim', 'family-sports', 'family-arts', 'early-years']],
  ['fitness', ['yoga', 'pilates', 'cardio', 'zumba', 'strength', 'hiit', 'gentle-fitness', 'walking']],
  ['games', ['club', 'board-games', 'card-games', 'billiards', 'darts', 'video-games', 'bingo']],
  ['older-adult', ['older-adult-arts-crafts', 'older-adult-games', 'older-adult-swimming', 'older-adult-fitness', 'older-adult-sports', 'older-adult-skating']],
  ['skating', ['hockey', 'leisure-skate', 'figure-skating', 'roller-skating']],
  ['specialized', ['adapted', 'lgbtq', 'women-only']],
  ['sports', ['basketball', 'badminton', 'pickleball', 'soccer', 'volleyball', 'table-tennis', 'hockey', 'multi-sport']],
  ['swimming', ['lane-swim', 'leisure-swim', 'family-swim', 'aquatic-fitness']],
  ['youth', ['youth-clubs', 'youth-enhanced', 'youth-arts', 'youth-fitness', 'youth-leadership', 'youth-sports', 'youth-skating']],
];

// Top programs by frequency (active only)
const programCounts = new Map();
dropIns.forEach(r => {
  if (r['Last Date'] >= todayStr) {
    programCounts.set(r['Course Title'], (programCounts.get(r['Course Title']) || 0) + 1);
  }
});
const topPrograms = [...programCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .map(([title]) => title);

// Locations that have at least one active program
const activeLocationIds = new Set(
  dropIns.filter(r => r['Last Date'] >= todayStr).map(r => r['Location ID'])
);
const activeLocationNames = locations
  .filter(loc => activeLocationIds.has(loc['Location ID']))
  .map(loc => loc['Location Name'])
  .sort();

function url(loc, changefreq, priority, includeLastmod = false) {
  const lastmod = includeLastmod ? `\n    <lastmod>${todayStr}</lastmod>` : '';
  return `  <url>\n    <loc>${loc}</loc>${lastmod}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const entries = [
  // Homepage and special dates — content genuinely changes daily
  url(`${BASE_URL}/`, 'daily', '1.0', true),
  url(`${BASE_URL}/?date=tomorrow`, 'daily', '0.9', true),
  url(`${BASE_URL}/?date=this-week`, 'daily', '0.9', true),

  // Category pages
  ...subcategories.map(([cat]) => url(`${BASE_URL}/?category=${cat}`, 'daily', '0.8')),

  // Subcategory pages
  ...subcategories.flatMap(([cat, subs]) =>
    subs.map(sub => url(`${BASE_URL}/?category=${escapeXml(cat)}&amp;subcategory=${sub}`, 'daily', '0.7'))
  ),

  // Top program pages
  ...topPrograms.map(prog => url(`${BASE_URL}/?program=${encodeURIComponent(prog)}`, 'daily', '0.6')),

  // Active location pages
  ...activeLocationNames.map(name => url(`${BASE_URL}/?locations=${encodeURIComponent(name)}`, 'daily', '0.7')),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8');
console.log(`Generated sitemap.xml (${activeLocationNames.length} locations, ${topPrograms.length} programs, lastmod ${todayStr})`);

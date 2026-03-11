// Scheduled function — runs daily at 6 AM UTC
// Scrapes Social Blade for follower counts and writes counts.json to GitHub

export const config = { schedule: "0 6 * * *" };

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = "indivisibleusa/indivisibleusa-site";
const FILE_PATH    = "counts.json";

const ACCOUNTS = {
  instagram: "dailypledgeofallegiance",
  tiktok:    "pledgeofallegiancedaily",
  facebook:  "61586344205021",
};

async function scrapeCount(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });
  return res.text();
}

function parseCount(html, label) {
  // Social Blade shows counts in spans with class "statsBarTopFollowers" or similar
  // Try multiple patterns
  const patterns = [
    /follower[s]?[\s\S]{0,200}?([\d,]+)/i,
    /"followers":\s*"?([\d,]+)"?/i,
    /Followers[\s\S]{0,100}?<[^>]+>([\d,.KM]+)<\/[^>]+>/i,
    /([\d,.]+[KM]?)\s*Followers/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function formatCount(raw) {
  if (!raw) return null;
  // Already formatted (e.g. "23.9K") — return as-is
  if (/[KMB]$/i.test(raw)) return raw.toUpperCase();
  // Strip commas, parse number
  const n = parseInt(raw.replace(/,/g, ""), 10);
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

async function getCurrentSha() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha;
}

async function pushToGitHub(counts, sha) {
  const content = btoa(JSON.stringify(counts, null, 2));
  const body = {
    message: `chore: update follower counts ${new Date().toISOString().slice(0,10)}`,
    content,
    ...(sha ? { sha } : {})
  };
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export default async function handler() {
  try {
    const [igHtml, ttHtml, fbHtml] = await Promise.all([
      scrapeCount(`https://socialblade.com/instagram/user/${ACCOUNTS.instagram}`),
      scrapeCount(`https://socialblade.com/tiktok/user/${ACCOUNTS.tiktok}`),
      scrapeCount(`https://socialblade.com/facebook/id/${ACCOUNTS.facebook}`),
    ]);

    const ig = formatCount(parseCount(igHtml, "instagram"));
    const tt = formatCount(parseCount(ttHtml, "tiktok"));
    const fb = formatCount(parseCount(fbHtml, "facebook"));

    // Compute total (raw numbers)
    const parse = (s) => {
      if (!s) return 0;
      const n = parseFloat(s);
      if (/M$/i.test(s)) return Math.round(n * 1_000_000);
      if (/K$/i.test(s)) return Math.round(n * 1_000);
      return Math.round(n);
    };
    const total = parse(ig) + parse(tt) + parse(fb);
    const totalFmt = formatCount(String(total));

    const counts = {
      updatedAt: new Date().toISOString(),
      instagram: ig  || "—",
      tiktok:    tt  || "—",
      facebook:  fb  || "—",
      total:     totalFmt || "—",
    };

    console.log("Counts:", counts);

    const sha = await getCurrentSha();
    const ok  = await pushToGitHub(counts, sha);
    console.log("GitHub push:", ok ? "success" : "failed");

  } catch (err) {
    console.error("update-counts error:", err);
  }
}

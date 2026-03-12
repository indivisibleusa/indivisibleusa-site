// Scheduled function — runs every 6 hours
// Fetches follower counts from Social Blade __NEXT_DATA__ JSON and writes counts.json to GitHub

export const config = { schedule: "0 */6 * * *" };

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO         = "indivisibleusa/indivisibleusa-site";
const FILE_PATH    = "counts.json";

async function fetchNextData(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    }
  });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function extractFollowers(data) {
  if (!data) return null;
  const queries = data?.props?.pageProps?.trpcState?.json?.queries || [];
  for (const q of queries) {
    const d = q?.state?.data;
    if (d && d.followers !== undefined) {
      return Number(d.followers);
    }
  }
  return null;
}

function fmt(n) {
  if (!n || isNaN(n)) return null;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

async function getCurrentSha() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (!res.ok) return null;
  return (await res.json()).sha;
}

async function pushToGitHub(counts, sha) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(counts, null, 2))));
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: "PUT",
    headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore: update follower counts ${new Date().toISOString().slice(0,10)}`,
      content,
      ...(sha ? { sha } : {})
    }),
  });
  return res.ok;
}

export default async function handler() {
  try {
    const [igData, ttData] = await Promise.all([
      fetchNextData("https://socialblade.com/instagram/user/dailypledgeofallegiance"),
      fetchNextData("https://socialblade.com/tiktok/user/pledgeofallegiancedaily"),
    ]);

    const instagram = extractFollowers(igData);
    const tiktok    = extractFollowers(ttData);
    const facebook  = 24000; // Not on Social Blade — kept as last known value

    const total = (instagram || 0) + (tiktok || 0) + facebook;

    const counts = {
      updatedAt: new Date().toISOString(),
      instagram: fmt(instagram) || "24.1K",
      tiktok:    fmt(tiktok)    || "5.6K",
      facebook:  fmt(facebook),
      total:     fmt(total),
    };

    console.log("Counts:", counts);

    const sha = await getCurrentSha();
    const ok  = await pushToGitHub(counts, sha);
    console.log("GitHub push:", ok ? "success" : "failed");

  } catch (err) {
    console.error("update-counts error:", err);
  }
}

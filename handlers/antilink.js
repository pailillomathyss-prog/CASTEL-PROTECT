import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const DATA_FILE = "./data/antilink.json";

function loadEnabled() {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    if (!existsSync(DATA_FILE)) return new Set();
    return new Set(JSON.parse(readFileSync(DATA_FILE, "utf8")));
  } catch { return new Set(); }
}

function saveEnabled(set) {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify([...set]), "utf8");
  } catch (e) { console.error("[antilink] Sauvegarde échouée :", e.message); }
}

export const antilinkEnabled = loadEnabled();
export function enableAntilink(guildId)  { antilinkEnabled.add(guildId);    saveEnabled(antilinkEnabled); }
export function disableAntilink(guildId) { antilinkEnabled.delete(guildId); saveEnabled(antilinkEnabled); }

// ── Détection (pas de flag g = pas de bug lastIndex) ──────────────────────────
const P_HTTP     = /https?:\/\//i;
const P_WWW      = /www\.[a-zA-Z0-9]/i;
const P_DISC_GG  = /discord\.gg\//i;
const P_DISC_INV = /discord(?:app)?\.com\/invite\//i;
const P_DSC      = /dsc\.gg\//i;
const P_BARE_TLD = /[a-z0-9-]+\.(?:com|net|org|io|gg|fr|xyz|co|tv|me|app|dev|live|shop|store|pro|online|info|biz|uk|de|ru|jp|cn|br|es|it|nl|pl|ca|au|be|ch|se|no|dk|fi|pt|gr|mx|ar|in|sg|gl|ly|sh|vc|to|cc|lol|wtf|club|social|media|link|bot|ovh|host|cloud)(?:\/|\s|$)/i;

const SOCIAL_DOMAINS = [
  "twitter.com","x.com","t.co","instagram.com","instagr.am","facebook.com","fb.com","fb.me",
  "tiktok.com","vm.tiktok.com","youtube.com","youtu.be","snapchat.com","snap.com","pinterest.com",
  "pin.it","linkedin.com","lnkd.in","reddit.com","redd.it","twitch.tv","tumblr.com","threads.net",
  "bsky.app","kick.com","rumble.com","dailymotion.com","vimeo.com","streamable.com","spotify.com",
  "soundcloud.com","deezer.com","tidal.com","patreon.com","onlyfans.com","linktr.ee","bit.ly",
  "tinyurl.com","goo.gl","ow.ly","buff.ly","cutt.ly","short.io","rebrand.ly","t.me","telegram.org",
  "telegram.me","wa.me","whatsapp.com","signal.org","vk.com","discord.gg","discord.com/invite",
  "discordapp.com/invite","dsc.gg",
];

function containsLink(content) {
  if (P_HTTP.test(content) || P_WWW.test(content)) return true;
  if (P_DISC_GG.test(content) || P_DISC_INV.test(content) || P_DSC.test(content)) return true;
  const low = content.toLowerCase();
  for (const d of SOCIAL_DOMAINS) if (low.includes(d)) return true;
  if (P_BARE_TLD.test(content)) return true;
  return false;
}

export async function handleAntiLink(message) {
  if (!containsLink(message.content)) return false;
  if (message.member.permissions.has("Administrator") || message.member.permissions.has("ManageMessages")) return false;
  try {
    await message.delete();
    const warn = await message.channel.send({
      embeds: [{ color: 0xff0000, title: "🚫 Lien supprimé", description: `${message.author}, les **liens et invitations** sont interdits sur ce serveur.`, footer: { text: "CASTEL PROTECT • Anti-lien" }, timestamp: new Date().toISOString() }],
    });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return true;
  } catch (err) {
    console.error("[antilink] Suppression échouée :", err.message);
    return false;
  }
}

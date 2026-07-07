import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

// ── Persistance ───────────────────────────────────────────────────────────────
const FILE = "./data/giveaways.json";

function load() {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch { return {}; }
}
function save(data) {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) { console.error("[giveaway] save:", e.message); }
}

// gwId -> { prize, endTime, channelId, guildId, messageId, participants: [] }
export const activeGiveaways = load();

// Timers en mémoire
const timers = new Map();

// ── Parseur de durée ──────────────────────────────────────────────────────────
function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  return parseInt(match[1]) * map[match[2].toLowerCase()];
}

function formatDuration(ms) {
  if (ms < 60000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000)  return `${Math.round(ms / 60000)}min`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}j`;
}

function formatEndTime(endTime) {
  return `<t:${Math.floor(endTime / 1000)}:R>`;
}

// ── Lancer un giveaway ────────────────────────────────────────────────────────
export async function executeGiveaway(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageGuild"))
    return message.reply("❌ Permission `Gérer le serveur` requise.");

  // !gw <durée> <lot...> ou !gw <lot...> <durée>
  // On cherche la durée dans tous les args
  if (args.length < 2)
    return message.reply(`❌ Usage : \`${PREFIX}gw <durée> <lot>\`\nExemple : \`${PREFIX}gw 10m Nitro 1 mois\``);

  let durationMs = null;
  let durationIndex = -1;

  for (let i = 0; i < args.length; i++) {
    const ms = parseDuration(args[i]);
    if (ms !== null) { durationMs = ms; durationIndex = i; break; }
  }

  if (!durationMs)
    return message.reply("❌ Durée invalide. Exemples : `30s`, `10m`, `2h`, `1d`");

  const prizeArgs = [...args];
  prizeArgs.splice(durationIndex, 1);
  const prize = prizeArgs.join(" ");
  if (!prize)
    return message.reply("❌ Précise le lot du giveaway.");

  const endTime = Date.now() + durationMs;
  const gwId    = `${Date.now()}_${message.guild.id}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_join_${gwId}`)
      .setLabel("🎉 Participer   0")
      .setStyle(ButtonStyle.Primary),
  );

  const gwMsg = await message.channel.send({
    embeds: [buildEmbed(prize, endTime, 0, message.author.tag)],
    components: [row],
  });

  activeGiveaways[gwId] = {
    prize,
    endTime,
    channelId: message.channel.id,
    guildId: message.guild.id,
    messageId: gwMsg.id,
    hostTag: message.author.tag,
    participants: [],
  };
  save(activeGiveaways);

  scheduleEnd(gwId, durationMs, gwMsg.client);
  await message.delete().catch(() => {});
}

// ── Bouton participer ─────────────────────────────────────────────────────────
export async function handleGiveawayJoin(interaction, gwId) {
  const gw = activeGiveaways[gwId];
  if (!gw)
    return interaction.reply({ content: "❌ Ce giveaway n'existe plus.", ephemeral: true });

  const userId = interaction.user.id;
  const idx    = gw.participants.indexOf(userId);

  if (idx === -1) {
    gw.participants.push(userId);
    save(activeGiveaways);
    await interaction.reply({ content: "✅ Tu participes au giveaway ! Bonne chance 🎉", ephemeral: true });
  } else {
    gw.participants.splice(idx, 1);
    save(activeGiveaways);
    await interaction.reply({ content: "↩️ Tu t'es retiré du giveaway.", ephemeral: true });
  }

  // Mettre à jour le compteur sur le bouton
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_join_${gwId}`)
      .setLabel(`🎉 Participer   ${gw.participants.length}`)
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.message.edit({
    embeds: [buildEmbed(gw.prize, gw.endTime, gw.participants.length, gw.hostTag)],
    components: [row],
  });
}

// ── Fin du giveaway ───────────────────────────────────────────────────────────
export function scheduleEnd(gwId, delay, client) {
  if (timers.has(gwId)) clearTimeout(timers.get(gwId));
  const timer = setTimeout(() => endGiveaway(gwId, client), delay);
  timers.set(gwId, timer);
}

async function endGiveaway(gwId, client) {
  timers.delete(gwId);
  const gw = activeGiveaways[gwId];
  if (!gw) return;

  try {
    const guild   = await client.guilds.fetch(gw.guildId);
    const channel = await guild.channels.fetch(gw.channelId);
    const msg     = await channel.messages.fetch(gw.messageId);

    // Tirer le gagnant
    let resultDesc;
    let winner = null;

    if (gw.participants.length === 0) {
      resultDesc = "😔 Personne n'a participé…";
    } else {
      const winnerId = gw.participants[Math.floor(Math.random() * gw.participants.length)];
      winner     = await guild.members.fetch(winnerId).catch(() => null);
      resultDesc = winner
        ? `🏆 Félicitations ${winner} ! Tu remportes **${gw.prize}** !`
        : "⚠️ Le gagnant tiré n'est plus sur le serveur.";
    }

    // Désactiver le bouton
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gw_join_${gwId}`)
        .setLabel(`🎉 Terminé   ${gw.participants.length} participant(s)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    await msg.edit({
      embeds: [{
        color: 0xffd700,
        title: "🎊 GIVEAWAY TERMINÉ",
        description: `**Lot :** ${gw.prize}\n\n${resultDesc}`,
        fields: [
          { name: "Participants", value: `${gw.participants.length}`, inline: true },
          { name: "Organisé par", value: gw.hostTag, inline: true },
        ],
        footer: { text: "CASTEL PROTECT • Giveaway" },
        timestamp: new Date().toISOString(),
      }],
      components: [disabledRow],
    });

    if (winner) {
      await channel.send({
        content: `🎉 ${winner} **tu as gagné : ${gw.prize} !** Félicitations !`,
      });
    }
  } catch (err) {
    console.error("[giveaway] endGiveaway:", err.message);
  }

  delete activeGiveaways[gwId];
  save(activeGiveaways);
}

// ── Reprendre les giveaways actifs au démarrage ───────────────────────────────
export function resumeGiveaways(client) {
  const now = Date.now();
  for (const [gwId, gw] of Object.entries(activeGiveaways)) {
    const remaining = gw.endTime - now;
    if (remaining <= 0) {
      endGiveaway(gwId, client);
    } else {
      scheduleEnd(gwId, remaining, client);
      console.log(`[giveaway] Repris : "${gw.prize}" dans ${formatDuration(remaining)}`);
    }
  }
}

// ── Embed helper ──────────────────────────────────────────────────────────────
function buildEmbed(prize, endTime, count, hostTag) {
  return {
    color: 0xff69b4,
    title: "🎉 GIVEAWAY",
    description:
      `**Lot :** ${prize}\n\n` +
      `🕐 Se termine ${formatEndTime(endTime)}\n` +
      `👥 ${count} participant(s)\n\n` +
      `Clique sur **🎉 Participer** pour entrer !\n_(Reclique pour te retirer)_`,
    fields: [{ name: "Organisé par", value: hostTag, inline: true }],
    footer: { text: "CASTEL PROTECT • Giveaway" },
    timestamp: new Date(endTime).toISOString(),
  };
}

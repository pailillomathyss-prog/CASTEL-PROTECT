import { ChannelType, PermissionFlagsBits } from "discord.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

// ── Persistance config ────────────────────────────────────────────────────────
const CONFIG_FILE = "./data/autovocal.json";

function loadConfig() {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    if (!existsSync(CONFIG_FILE)) return {};
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch { return {}; }
}
function saveConfig(cfg) {
  try {
    if (!existsSync("./data")) mkdirSync("./data", { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch (e) { console.error("[autovocal] save:", e.message); }
}

// guildId -> { hubChannelId, categoryId? }
export const vocalConfig = loadConfig();

// channelId -> ownerId
export const tempChannels = new Map();

// ── Helper : vérifie que l'auteur est proprio du salon où il se trouve ────────
function checkOwner(message) {
  const vcState = message.member.voice;
  if (!vcState?.channel) return { error: "❌ Tu n'es dans aucun salon vocal." };
  const channelId = vcState.channel.id;
  const ownerId   = tempChannels.get(channelId);
  if (!ownerId)    return { error: "❌ Ce salon n'est pas un salon temporaire." };
  if (ownerId !== message.member.id && !message.member.permissions.has("ManageChannels"))
    return { error: "❌ Tu n'es pas le propriétaire de ce salon." };
  return { channel: vcState.channel };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export async function executeVocalSetup(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageChannels"))
    return message.reply("❌ Permission `Gérer les salons` requise.");

  // Accepte une mention OU un ID brut
  const rawId = args[0]?.replace(/[<#>]/g, "");
  if (!rawId)
    return message.reply(`❌ Usage : \`${PREFIX}vocal setup <#salon ou ID>\``);

  const vc = message.guild.channels.cache.get(rawId);
  if (!vc || vc.type !== ChannelType.GuildVoice)
    return message.reply("❌ Salon vocal introuvable. Vérifie l'ID ou la mention.");

  vocalConfig[message.guild.id] = { hubChannelId: vc.id, categoryId: vc.parentId || null };
  saveConfig(vocalConfig);

  await message.reply(`✅ Hub configuré : **${vc.name}** (\`${vc.id}\`) — rejoins-le pour créer ton propre salon.`);
}

// ── Rename ────────────────────────────────────────────────────────────────────
export async function executeVocalRename(message, args, PREFIX) {
  const { error, channel } = checkOwner(message);
  if (error) return message.reply(error);

  const newName = args.join(" ").trim().slice(0, 100);
  if (!newName) return message.reply(`❌ Usage : \`${PREFIX}vocal rename <nouveau nom>\``);

  await channel.setName(newName);
  await message.reply(`✅ Salon renommé en **${newName}** !`);
}

// ── Limit ─────────────────────────────────────────────────────────────────────
export async function executeVocalLimit(message, args, PREFIX) {
  const { error, channel } = checkOwner(message);
  if (error) return message.reply(error);

  const limit = parseInt(args[0]);
  if (isNaN(limit) || limit < 0 || limit > 99)
    return message.reply(`❌ Usage : \`${PREFIX}vocal limit <0-99>\` _(0 = illimité)_`);

  await channel.setUserLimit(limit);
  await message.reply(limit === 0 ? "✅ Salon **illimité**." : `✅ Limite fixée à **${limit} membre(s)**.`);
}

// ── Lock ──────────────────────────────────────────────────────────────────────
export async function executeVocalLock(message) {
  const { error, channel } = checkOwner(message);
  if (error) return message.reply(error);

  await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
    Connect: false,
  });
  await message.reply("🔒 Salon **verrouillé** — plus personne ne peut rejoindre.");
}

// ── Unlock ────────────────────────────────────────────────────────────────────
export async function executeVocalUnlock(message) {
  const { error, channel } = checkOwner(message);
  if (error) return message.reply(error);

  await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
    Connect: null, // reset à la permission par défaut
  });
  await message.reply("🔓 Salon **déverrouillé** — tout le monde peut rejoindre.");
}

// ── Kick ──────────────────────────────────────────────────────────────────────
export async function executeVocalKick(message, PREFIX) {
  const { error, channel } = checkOwner(message);
  if (error) return message.reply(error);

  const target = message.mentions.members.first();
  if (!target) return message.reply(`❌ Usage : \`${PREFIX}vocal kick @user\``);
  if (target.id === message.member.id) return message.reply("❌ Tu ne peux pas t'expulser toi-même.");
  if (target.voice?.channelId !== channel.id) return message.reply("❌ Ce membre n'est pas dans ton salon.");

  await target.voice.disconnect();
  await message.reply(`✅ **${target.displayName}** a été expulsé du salon.`);
}

// ── VoiceStateUpdate handler ──────────────────────────────────────────────────
export async function handleVoiceStateUpdate(oldState, newState) {
  const guild  = newState.guild || oldState.guild;
  const config = vocalConfig[guild.id];
  if (!config) return;

  // ── Quelqu'un rejoint le hub → créer son salon ────────────────────────────
  if (newState.channelId === config.hubChannelId && newState.member) {
    const member = newState.member;
    const PREFIX = process.env.PREFIX || "!";

    try {
      const newChannel = await guild.channels.create({
        name: `🔊 ${member.displayName}`,
        type: ChannelType.GuildVoice,
        parent: config.categoryId || null,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
            ],
          },
        ],
        userLimit: 0,
      });

      tempChannels.set(newChannel.id, member.id);
      await member.voice.setChannel(newChannel);

      // Message d'accueil dans le chat de la vocal
      await newChannel.send({
        embeds: [{
          color: 0x5865f2,
          title: "🔊 Ton salon vocal",
          description:
            `Bienvenue ${member} ! Ce salon t'appartient.\n\n` +
            `**Commandes disponibles ici :**\n` +
            `\`${PREFIX}vocal rename <nom>\` — Renommer ce salon\n` +
            `\`${PREFIX}vocal limit <nombre>\` — Limiter le nombre de membres _(0 = illimité)_\n` +
            `\`${PREFIX}vocal lock\` — Verrouiller _(personne d'autre ne peut rejoindre)_\n` +
            `\`${PREFIX}vocal unlock\` — Déverrouiller\n` +
            `\`${PREFIX}vocal kick @user\` — Expulser quelqu'un de ta vocal\n\n` +
            `_Le salon sera supprimé automatiquement quand il sera vide._`,
          footer: { text: "CASTEL PROTECT • Salons vocaux" },
        }],
      });
    } catch (err) {
      console.error("[autovocal] Création échouée :", err.message);
    }
  }

  // ── Quelqu'un quitte un salon temporaire → supprimer si vide ─────────────
  if (oldState.channelId && tempChannels.has(oldState.channelId)) {
    const ch = oldState.channel;
    if (ch && ch.members.size === 0) {
      tempChannels.delete(ch.id);
      await ch.delete("Salon vocal temporaire vide").catch(() => {});
    }
  }
}

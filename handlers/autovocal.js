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

// Salons temporaires en mémoire : channelId -> ownerId
export const tempChannels = new Map();

// ── Setup ─────────────────────────────────────────────────────────────────────
export async function executeVocalSetup(message, PREFIX) {
  if (!message.member.permissions.has("ManageChannels"))
    return message.reply("❌ Permission `Gérer les salons` requise.");

  const vc = message.mentions.channels.first();
  if (!vc || vc.type !== ChannelType.GuildVoice)
    return message.reply(
      `❌ Mentionne un **salon vocal**.\nUsage : \`${PREFIX}vocal setup #salon-vocal\``
    );

  vocalConfig[message.guild.id] = {
    hubChannelId: vc.id,
    categoryId: vc.parentId || null,
  };
  saveConfig(vocalConfig);

  await message.reply(
    `✅ Système de salons vocaux configuré !\n` +
    `• Hub : **${vc.name}** — rejoins-le pour créer ton propre salon vocal.`
  );
}

// ── Rename ────────────────────────────────────────────────────────────────────
export async function executeVocalRename(message, args, PREFIX) {
  const member  = message.member;
  const vcState = member.voice;

  if (!vcState?.channel)
    return message.reply("❌ Tu n'es dans aucun salon vocal.");

  const channelId = vcState.channel.id;
  const ownerId   = tempChannels.get(channelId);

  if (!ownerId)
    return message.reply("❌ Ce salon n'est pas un salon temporaire.");

  if (ownerId !== member.id && !member.permissions.has("ManageChannels"))
    return message.reply("❌ Tu n'es pas le propriétaire de ce salon.");

  const newName = args.join(" ").trim().slice(0, 100);
  if (!newName)
    return message.reply(`❌ Usage : \`${PREFIX}vocal rename <nouveau nom>\``);

  await vcState.channel.setName(newName);
  await message.reply(`✅ Salon renommé en **${newName}** !`);
}

// ── VoiceStateUpdate handler ──────────────────────────────────────────────────
export async function handleVoiceStateUpdate(oldState, newState) {
  const guild  = newState.guild || oldState.guild;
  const config = vocalConfig[guild.id];
  if (!config) return;

  // ── Quelqu'un rejoint le hub → créer son salon ────────────────────────────
  if (newState.channelId === config.hubChannelId && newState.member) {
    const member = newState.member;
    const name   = `🔊 ${member.displayName}`;

    try {
      const newChannel = await guild.channels.create({
        name,
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

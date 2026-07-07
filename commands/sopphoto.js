import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

// ── Persistance config ────────────────────────────────────────────────────────
const CONFIG_FILE = "./data/sopphoto.json";

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
  } catch (e) { console.error("[sopphoto] Sauvegarde échouée :", e.message); }
}

export const sopConfig = loadConfig();

// ── Votes en mémoire ─────────────────────────────────────────────────────────
// sessionId -> { smashers: Set<userId>, passers: Set<userId>, messageId, channelId, guildId }
export const voteData = new Map();

// Utilisateurs en attente de soumission de photo (via DM)
// userId -> { guildId, votesChannelId, username }
export const pendingSubmissions = new Map();

// ── Setup ─────────────────────────────────────────────────────────────────────
/**
 * !sopphoto setup #panel #votes
 */
export async function executeSopPhotoSetup(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageChannels"))
    return message.reply("❌ Permission `Gérer les salons` requise.");

  const channels = message.mentions.channels;
  if (channels.size < 2)
    return message.reply(
      `❌ Mentionne 2 salons.\nUsage : \`${PREFIX}sopphoto setup #panel #votes\`\n` +
      `• **#panel** — salon en lecture seule avec le bouton de soumission\n` +
      `• **#votes** — salon où les photos apparaissent pour voter`
    );

  const [panelChannel, votesChannel] = [...channels.values()];

  // Rendre le panel en lecture seule pour @everyone
  await panelChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
    SendMessages: false,
    AddReactions: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  });

  // Rendre les votes en lecture seule aussi (seul le bot écrit)
  await votesChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
    SendMessages: false,
    AddReactions: false,
  });

  // Sauvegarder la config
  sopConfig[message.guild.id] = {
    panelChannelId: panelChannel.id,
    votesChannelId: votesChannel.id,
  };
  saveConfig(sopConfig);

  // Envoyer le panel
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sop_submit")
      .setLabel("📸 Soumettre ma photo")
      .setStyle(ButtonStyle.Primary),
  );

  await panelChannel.send({
    embeds: [{
      color: 0xff69b4,
      title: "💥 Smash or Pass — Photos",
      description:
        "Tu penses mériter un **Smash** ? Soumet ta photo et laisse la communauté décider !\n\n" +
        "📸 Clique sur le bouton ci-dessous\n" +
        "📩 Le bot t'enverra un message privé\n" +
        "🗳️ Ta photo sera publiée ici pour que tout le monde vote",
      footer: { text: "CASTEL PROTECT • Smash or Pass Photos" },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  });

  await message.reply(
    `✅ Système Smash or Pass photos configuré !\n` +
    `• Panel : ${panelChannel}\n` +
    `• Votes : ${votesChannel}`
  );
}

// ── Bouton "Soumettre ma photo" ───────────────────────────────────────────────
export async function handleSopSubmitButton(interaction) {
  const guildId = interaction.guild.id;
  const config  = sopConfig[guildId];

  if (!config)
    return interaction.reply({
      content: "❌ Le système n'est pas configuré. Un admin doit faire `!sopphoto setup #panel #votes`.",
      ephemeral: true,
    });

  const userId = interaction.user.id;

  // Marquer l'utilisateur comme en attente
  pendingSubmissions.set(userId, {
    guildId,
    votesChannelId: config.votesChannelId,
    username: interaction.user.username,
  });

  // Timeout de 3 minutes pour la soumission
  setTimeout(() => pendingSubmissions.delete(userId), 3 * 60 * 1000);

  try {
    await interaction.user.send({
      embeds: [{
        color: 0xff69b4,
        title: "📸 Soumission Smash or Pass",
        description:
          "Envoie ta **photo** ici en message privé et elle sera publiée dans le salon de vote !\n\n" +
          "⚠️ Tu as **3 minutes** pour envoyer ta photo.\n" +
          "✅ Une seule photo acceptée (JPG, PNG, GIF, WEBP)",
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
    });

    await interaction.reply({
      content: "📩 Vérifie tes **messages privés** ! Envoie ta photo au bot directement.",
      ephemeral: true,
    });
  } catch {
    pendingSubmissions.delete(userId);
    await interaction.reply({
      content: "❌ Je ne peux pas t'envoyer de message privé. Active tes DMs (`Paramètres → Confidentialité → Messages privés des membres du serveur`).",
      ephemeral: true,
    });
  }
}

// ── Réception de la photo en DM ───────────────────────────────────────────────
export async function handleSopDm(message, client) {
  const userId  = message.author.id;
  const pending = pendingSubmissions.get(userId);
  if (!pending) return; // Pas en attente

  // Chercher une image dans les attachments
  const image = message.attachments.find((a) =>
    a.contentType && a.contentType.startsWith("image/")
  );

  if (!image) {
    return message.reply("❌ Envoie une **image** (JPG, PNG, GIF, WEBP).");
  }

  pendingSubmissions.delete(userId);

  try {
    const guild        = await client.guilds.fetch(pending.guildId);
    const votesChannel = await guild.channels.fetch(pending.votesChannelId);

    // Générer un ID unique pour cette session de vote
    const sessionId = `${Date.now()}_${userId.slice(-4)}`;

    const smashRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sop_smash_${sessionId}`)
        .setLabel("💪 Smash   0")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sop_pass_${sessionId}`)
        .setLabel("❌ Pass   0")
        .setStyle(ButtonStyle.Danger),
    );

    const voteMsg = await votesChannel.send({
      embeds: [{
        color: 0xff69b4,
        title: "💥 Smash or Pass",
        description: "Vote maintenant ! 💪 **Smash** ou ❌ **Pass** ?",
        image: { url: image.url },
        footer: { text: `Soumis anonymement • CASTEL PROTECT` },
        timestamp: new Date().toISOString(),
      }],
      components: [smashRow],
    });

    // Enregistrer les données de vote
    voteData.set(sessionId, {
      smashers: new Set(),
      passers: new Set(),
      messageId: voteMsg.id,
      channelId: votesChannel.id,
      guildId: pending.guildId,
    });

    await message.reply({
      embeds: [{
        color: 0x00c851,
        title: "✅ Photo soumise !",
        description: "Ta photo a été publiée dans le salon de vote. Bonne chance ! 🎉",
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
    });
  } catch (err) {
    console.error("[sopphoto] handleSopDm :", err);
    await message.reply("❌ Erreur lors de la soumission. Réessaie plus tard.");
  }
}

// ── Vote Smash / Pass ─────────────────────────────────────────────────────────
export async function handleSopVote(interaction, voteType, sessionId) {
  const session = voteData.get(sessionId);
  if (!session)
    return interaction.reply({ content: "❌ Ce vote a expiré.", ephemeral: true });

  const userId = interaction.user.id;
  const { smashers, passers } = session;

  if (voteType === "smash") {
    if (smashers.has(userId))
      return interaction.reply({ content: "✋ Tu as déjà voté **Smash** ! Clique **Pass** pour changer.", ephemeral: true });
    passers.delete(userId);
    smashers.add(userId);
  } else {
    if (passers.has(userId))
      return interaction.reply({ content: "✋ Tu as déjà voté **Pass** ! Clique **Smash** pour changer.", ephemeral: true });
    smashers.delete(userId);
    passers.add(userId);
  }

  const total      = smashers.size + passers.size;
  const smashPct   = total > 0 ? Math.round((smashers.size / total) * 100) : 0;
  const passPct    = 100 - smashPct;

  const updatedRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sop_smash_${sessionId}`)
      .setLabel(`💪 Smash   ${smashers.size}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sop_pass_${sessionId}`)
      .setLabel(`❌ Pass   ${passers.size}`)
      .setStyle(ButtonStyle.Danger),
  );

  const bar = buildBar(smashPct);

  await interaction.update({
    embeds: [{
      color: 0xff69b4,
      title: "💥 Smash or Pass",
      description:
        `Vote maintenant ! 💪 **Smash** ou ❌ **Pass** ?\n\n` +
        `${bar}\n` +
        `💪 **${smashPct}%** Smash  •  **${passPct}%** Pass ❌\n` +
        `_${total} votant(s)_`,
      image: { url: interaction.message.embeds[0]?.image?.url },
      footer: { text: `Soumis anonymement • CASTEL PROTECT` },
      timestamp: interaction.message.embeds[0]?.timestamp,
    }],
    components: [updatedRow],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildBar(smashPct) {
  const len      = 16;
  const smashLen = Math.round((smashPct / 100) * len);
  const passLen  = len - smashLen;
  return "🟩".repeat(smashLen) + "🟥".repeat(passLen);
}

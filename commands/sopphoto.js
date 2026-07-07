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

// ── Votes en mémoire ──────────────────────────────────────────────────────────
// sessionId -> { smashers, passers, messageId, channelId, guildId }
export const voteData = new Map();

// Utilisateurs en attente de soumission
// userId -> { guildId, votesChannelId, anonymous: bool }
export const pendingSubmissions = new Map();

// ── Setup ─────────────────────────────────────────────────────────────────────
export async function executeSopPhotoSetup(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageChannels"))
    return message.reply("❌ Permission `Gérer les salons` requise.");

  const channels = message.mentions.channels;
  if (channels.size < 2)
    return message.reply(
      `❌ Mentionne 2 salons.\nUsage : \`${PREFIX}sopphoto setup #panel #votes\``
    );

  const [panelChannel, votesChannel] = [...channels.values()];

  await panelChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
    SendMessages: false, AddReactions: false,
    CreatePublicThreads: false, CreatePrivateThreads: false,
  });
  await votesChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
    SendMessages: false, AddReactions: false,
  });

  sopConfig[message.guild.id] = {
    panelChannelId: panelChannel.id,
    votesChannelId: votesChannel.id,
  };
  saveConfig(sopConfig);

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
        "🕵️ Choisis d'apparaître **anonymement** ou **avec ton pseudo**\n" +
        "🗳️ La communauté vote avec 💪 Smash ou ❌ Pass",
      footer: { text: "CASTEL PROTECT • Smash or Pass Photos" },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  });

  await message.reply(`✅ Configuré !\n• Panel : ${panelChannel}\n• Votes : ${votesChannel}`);
}

// ── Bouton "Soumettre ma photo" → choix anonyme/public ───────────────────────
export async function handleSopSubmitButton(interaction) {
  const config = sopConfig[interaction.guild.id];
  if (!config)
    return interaction.reply({
      content: "❌ Système non configuré. Fais `!sopphoto setup #panel #votes`.",
      ephemeral: true,
    });

  // Proposer le choix : anonyme ou avec pseudo
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sop_anon")
      .setLabel("🕵️ Anonyme")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("sop_public")
      .setLabel("👤 Avec mon pseudo")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({
    embeds: [{
      color: 0xff69b4,
      title: "📸 Comment veux-tu apparaître ?",
      description:
        "🕵️ **Anonyme** — personne ne saura que c'est toi\n" +
        "👤 **Avec mon pseudo** — ton pseudo et ta photo de profil seront affichés",
      footer: { text: "CASTEL PROTECT • Smash or Pass" },
    }],
    components: [row],
    ephemeral: true,
  });
}

// ── Choix anonyme ou public ───────────────────────────────────────────────────
export async function handleSopModeChoice(interaction, anonymous) {
  const config = sopConfig[interaction.guild.id];
  if (!config)
    return interaction.reply({ content: "❌ Système non configuré.", ephemeral: true });

  const userId = interaction.user.id;

  pendingSubmissions.set(userId, {
    guildId: interaction.guild.id,
    votesChannelId: config.votesChannelId,
    anonymous,
    username: interaction.user.username,
    avatarUrl: interaction.user.displayAvatarURL({ size: 64 }),
  });

  // Timeout 3 minutes
  setTimeout(() => pendingSubmissions.delete(userId), 3 * 60 * 1000);

  try {
    await interaction.user.send({
      embeds: [{
        color: anonymous ? 0x888888 : 0xff69b4,
        title: anonymous ? "🕵️ Mode anonyme activé" : "👤 Mode public activé",
        description:
          `Tu vas apparaître **${anonymous ? "anonymement" : "avec ton pseudo"}**.\n\n` +
          "Envoie ta **photo** ici en message privé maintenant !\n" +
          "⏱️ Tu as **3 minutes**.",
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
    });

    await interaction.update({
      embeds: [{
        color: 0x00c851,
        title: "📩 Check tes messages privés !",
        description: `Mode choisi : **${anonymous ? "🕵️ Anonyme" : "👤 " + interaction.user.username}**\nEnvoie ta photo au bot en DM.`,
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
      components: [],
    });
  } catch {
    pendingSubmissions.delete(userId);
    await interaction.update({
      embeds: [{
        color: 0xff0000,
        title: "❌ DMs fermés",
        description: "Active tes messages privés : **Paramètres → Confidentialité → Messages privés des membres du serveur**.",
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
      components: [],
    });
  }
}

// ── Réception de la photo en DM ───────────────────────────────────────────────
export async function handleSopDm(message, client) {
  const userId  = message.author.id;
  const pending = pendingSubmissions.get(userId);
  if (!pending) return;

  const image = message.attachments.find(
    (a) => a.contentType && a.contentType.startsWith("image/")
  );
  if (!image)
    return message.reply("❌ Envoie une **image** (JPG, PNG, GIF, WEBP).");

  pendingSubmissions.delete(userId);

  try {
    const guild        = await client.guilds.fetch(pending.guildId);
    const votesChannel = await guild.channels.fetch(pending.votesChannelId);
    const sessionId    = `${Date.now()}_${userId.slice(-4)}`;

    const voteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sop_smash_${sessionId}`)
        .setLabel("💪 Smash   0")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sop_pass_${sessionId}`)
        .setLabel("❌ Pass   0")
        .setStyle(ButtonStyle.Danger),
    );

    // Embed selon le mode
    const embed = {
      color: 0xff69b4,
      title: "💥 Smash or Pass",
      description: "Vote ! 💪 **Smash** ou ❌ **Pass** ?",
      image: { url: image.url },
      timestamp: new Date().toISOString(),
    };

    if (pending.anonymous) {
      embed.footer = { text: "Soumis anonymement • CASTEL PROTECT" };
    } else {
      embed.author = {
        name: pending.username,
        icon_url: pending.avatarUrl,
      };
      embed.footer = { text: "CASTEL PROTECT • Smash or Pass" };
    }

    const voteMsg = await votesChannel.send({ embeds: [embed], components: [voteRow] });

    voteData.set(sessionId, {
      smashers: new Set(),
      passers: new Set(),
      messageId: voteMsg.id,
      channelId: votesChannel.id,
      guildId: pending.guildId,
      anonymous: pending.anonymous,
      username: pending.username,
      avatarUrl: pending.avatarUrl,
    });

    await message.reply({
      embeds: [{
        color: 0x00c851,
        title: "✅ Photo soumise !",
        description: `Ta photo a été publiée ${pending.anonymous ? "**anonymement**" : "**avec ton pseudo**"} dans le salon de vote. Bonne chance ! 🎉`,
        footer: { text: "CASTEL PROTECT • Smash or Pass" },
      }],
    });
  } catch (err) {
    console.error("[sopphoto] handleSopDm :", err);
    await message.reply("❌ Erreur lors de la soumission. Réessaie plus tard.");
  }
}

// ── Vote ──────────────────────────────────────────────────────────────────────
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

  const total    = smashers.size + passers.size;
  const smashPct = total > 0 ? Math.round((smashers.size / total) * 100) : 0;
  const passPct  = 100 - smashPct;
  const bar      = "🟩".repeat(Math.round((smashPct / 100) * 16)) + "🟥".repeat(Math.round((passPct / 100) * 16));

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

  const originalEmbed = interaction.message.embeds[0];
  const embed = {
    color: 0xff69b4,
    title: "💥 Smash or Pass",
    description:
      `Vote ! 💪 **Smash** ou ❌ **Pass** ?\n\n` +
      `${bar}\n` +
      `💪 **${smashPct}%**  •  **${passPct}%** ❌   _${total} vote(s)_`,
    image: { url: originalEmbed?.image?.url },
    timestamp: originalEmbed?.timestamp,
  };

  if (session.anonymous) {
    embed.footer = { text: "Soumis anonymement • CASTEL PROTECT" };
  } else {
    embed.author = { name: session.username, icon_url: session.avatarUrl };
    embed.footer = { text: "CASTEL PROTECT • Smash or Pass" };
  }

  await interaction.update({ embeds: [embed], components: [updatedRow] });
}

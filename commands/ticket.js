import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";

// ── Panel ──────────────────────────────────────────────────────────────────────
export async function executeTicketSetup(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageChannels"))
    return message.reply("❌ Permission `Gérer les salons` requise.");

  const channel = message.mentions.channels.first() || message.channel;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_rankup").setLabel("📈 Rank Up").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_bugreport").setLabel("🐛 Bug Report").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_autre").setLabel("❓ Autre").setStyle(ButtonStyle.Secondary),
  );

  await channel.send({
    embeds: [{
      color: 0x5865f2,
      title: "🎫 Système de Tickets — CASTEL PROTECT",
      description:
        "Clique sur le bouton correspondant à ta demande pour ouvrir un ticket.\n\n" +
        "📈 **Rank Up** — Demande une montée en grade\n" +
        "🐛 **Bug Report** — Signale un bug ou un problème\n" +
        "❓ **Autre** — Toute autre demande ou question",
      footer: { text: "CASTEL PROTECT • Support" },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  });

  if (channel.id !== message.channel.id)
    await message.reply(`✅ Panel de tickets envoyé dans ${channel}.`);
}

// ── Création d'un ticket ──────────────────────────────────────────────────────
export async function createTicket(interaction, type) {
  const guild  = interaction.guild;
  const member = interaction.member;

  const existing = guild.channels.cache.find(
    (c) => c.name === ticketChannelName(member.user.username, type) && c.type === ChannelType.GuildText
  );
  if (existing)
    return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : ${existing}`, ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "tickets"
    );
    if (!category)
      category = await guild.channels.create({ name: "Tickets", type: ChannelType.GuildCategory });

    const permissionOverwrites = [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    guild.roles.cache.forEach((role) => {
      if (role.permissions.has(PermissionFlagsBits.ManageGuild) || role.permissions.has(PermissionFlagsBits.Administrator)) {
        permissionOverwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        });
      }
    });

    const ticketChannel = await guild.channels.create({
      name: ticketChannelName(member.user.username, type),
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites,
      topic: `Ticket ${typeLabel(type)} de ${member.user.tag}`,
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Secondary),
    );

    await ticketChannel.send({
      content: `${member}`,
      embeds: [{
        color: typeColor(type),
        title: `${typeEmoji(type)} Ticket ${typeLabel(type)}`,
        description:
          `Bonjour ${member} ! Un membre du staff va te répondre très bientôt.\n\n` +
          typeInstructions(type),
        fields: [
          { name: "Membre", value: `${member.user.tag} (${member.id})`, inline: true },
          { name: "Type",   value: typeLabel(type),                      inline: true },
        ],
        footer: { text: "CASTEL PROTECT • Tickets | Clique 🔒 pour fermer" },
        timestamp: new Date().toISOString(),
      }],
      components: [closeRow],
    });

    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
  } catch (err) {
    console.error("[ticket] createTicket :", err);
    await interaction.editReply({ content: "❌ Erreur lors de la création du ticket." });
  }
}

// ── Fermeture ─────────────────────────────────────────────────────────────────
export async function closeTicket(interaction) {
  const channel = interaction.channel;
  const member  = interaction.member;

  const isTicketChannel =
    channel.name.startsWith("rankup-") ||
    channel.name.startsWith("bugreport-") ||
    channel.name.startsWith("autre-");

  if (!isTicketChannel)
    return interaction.reply({ content: "❌ Ce n'est pas un salon de ticket.", ephemeral: true });

  await interaction.reply({
    embeds: [{
      color: 0xff0000,
      title: "🔒 Fermeture du ticket",
      description: `Ticket fermé par ${member}. Le salon sera supprimé dans **5 secondes**.`,
      timestamp: new Date().toISOString(),
    }],
  });

  setTimeout(async () => {
    await channel.delete(`Ticket fermé par ${member.user.tag}`).catch(() => {});
  }, 5000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ticketChannelName(username, type) {
  const clean = username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
  return `${type}-${clean}`;
}

function typeLabel(type) {
  if (type === "rankup")    return "Rank Up";
  if (type === "bugreport") return "Bug Report";
  return "Autre";
}

function typeEmoji(type) {
  if (type === "rankup")    return "📈";
  if (type === "bugreport") return "🐛";
  return "❓";
}

function typeColor(type) {
  if (type === "rankup")    return 0x00c851;
  if (type === "bugreport") return 0xff4444;
  return 0xffa500;
}

function typeInstructions(type) {
  if (type === "rankup")
    return (
      "**Pour ta demande de Rank Up, merci de préciser :**\n" +
      "• Ton pseudo en jeu\n" +
      "• Ton rang actuel\n" +
      "• Le rang demandé\n" +
      "• Tes preuves (screenshots, vidéos…)"
    );
  if (type === "bugreport")
    return (
      "**Pour ton Bug Report, merci de préciser :**\n" +
      "• Description du bug\n" +
      "• Comment le reproduire\n" +
      "• Screenshots ou vidéos si possible\n" +
      "• Date / heure à laquelle tu l'as rencontré"
    );
  return (
    "**Explique-nous ta demande :**\n" +
    "• Décris ton problème ou ta question en détail\n" +
    "• Ajoute des screenshots si nécessaire\n" +
    "Un membre du staff reviendra vers toi dès que possible."
  );
}

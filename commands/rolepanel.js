import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";

// ─── Noms des rôles (doivent exister sur le serveur) ─────────────────────────
const ROLES = {
  homme:  "Homme",
  femme:  "Femme",
  egirl:  "Egirl",
  majeur: "Majeur",
  mineur: "Mineur",
};

// Groupes exclusifs : choisir l'un retire les autres du même groupe
const GENRE_GROUP = [ROLES.homme, ROLES.femme, ROLES.egirl];
const AGE_GROUP   = [ROLES.majeur, ROLES.mineur];

// ─── Construit l'embed + les boutons du panel ─────────────────────────────────
function buildPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Choisis tes rôles")
    .setDescription(
      "Clique sur un bouton pour obtenir ou retirer un rôle.\n" +
      "Choisir un autre genre / tranche d'âge remplace automatiquement le précédent.\n\n" +
      "**Genre** — Homme • Femme • Egirl\n" +
      "**Âge** — Majeur • Mineur\n\n" +
      "Clique sur **🚫 Rien** pour tout retirer.",
    )
    .setColor(0x5865f2);

  // Ligne 1 : Genre
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("role_homme") .setLabel("Homme") .setEmoji("👨").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_femme") .setLabel("Femme") .setEmoji("👩").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("role_egirl") .setLabel("Egirl") .setEmoji("💅").setStyle(ButtonStyle.Primary),
  );

  // Ligne 2 : Âge + Rien
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("role_majeur").setLabel("Majeur").setEmoji("🔞").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("role_mineur").setLabel("Mineur").setEmoji("🧒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("role_rien")  .setLabel("Rien")  .setEmoji("🚫").setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ─── Commande !rolepanel setup ────────────────────────────────────────────────
export async function executeRolePanel(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Admin seulement.");
    return;
  }
  await message.channel.send(buildPanel());
  await message.reply("✅ Panel de rôles posté !").then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
}

// ─── Gestion des clics sur les boutons ────────────────────────────────────────
export async function handleRoleButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild  = interaction.guild;
  const member = interaction.member;
  const id     = interaction.customId; // ex: "role_homme"

  // ── Cas spécial : tout retirer ────────────────────────────────────────────
  if (id === "role_rien") {
    const toRemove = [...Object.values(ROLES)];
    const removed = [];
    for (const roleName of toRemove) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => {});
        removed.push(roleName);
      }
    }
    const msg = removed.length
      ? `🚫 Rôles retirés : ${removed.join(", ")}`
      : "Tu n'avais aucun rôle à retirer.";
    await interaction.editReply(msg);
    return;
  }

  // ── Détermine le rôle cible et son groupe ─────────────────────────────────
  const roleKey  = id.replace("role_", ""); // "homme", "femme", etc.
  const roleName = ROLES[roleKey];
  if (!roleName) { await interaction.editReply("❌ Rôle inconnu."); return; }

  const targetRole = guild.roles.cache.find((r) => r.name === roleName);
  if (!targetRole) {
    await interaction.editReply(
      `❌ Le rôle **${roleName}** n'existe pas sur ce serveur.\nCrée-le d'abord dans Paramètres > Rôles.`,
    );
    return;
  }

  // ── Si l'utilisateur a déjà ce rôle → on le retire (toggle) ──────────────
  if (member.roles.cache.has(targetRole.id)) {
    await member.roles.remove(targetRole);
    await interaction.editReply(`✅ Rôle **${roleName}** retiré.`);
    return;
  }

  // ── Retire les rôles du même groupe (exclusivité) ─────────────────────────
  const group = GENRE_GROUP.includes(roleName) ? GENRE_GROUP : AGE_GROUP;
  for (const conflictName of group) {
    if (conflictName === roleName) continue;
    const conflictRole = guild.roles.cache.find((r) => r.name === conflictName);
    if (conflictRole && member.roles.cache.has(conflictRole.id)) {
      await member.roles.remove(conflictRole).catch(() => {});
    }
  }

  // ── Donne le rôle ─────────────────────────────────────────────────────────
  await member.roles.add(targetRole);
  await interaction.editReply(`✅ Rôle **${roleName}** attribué !`);
}

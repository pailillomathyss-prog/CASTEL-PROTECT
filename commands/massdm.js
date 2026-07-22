import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

// ─── Config embed ─────────────────────────────────────────────────────────────
const EMBED_TITLE       = "VSEY #NEW";
const EMBED_DESCRIPTION = "VSEY EST UN NOUVEAU SERVEUR COMMUNAUTAIRE PRÊT À VOUS ACCUEILLIR , A VOUS ACCOMPAGNER DANS VOS PROJET , JOUER , PARLER , VOC EXT";
const EMBED_COLOR       = 0x5865f2;
const BUTTON_LABEL      = "JOIN";
const BUTTON_URL        = "https://discord.gg/zF6u4YWyWG";
// ─────────────────────────────────────────────────────────────────────────────

export const massDmCommand = new SlashCommandBuilder()
  .setName("dmall")
  .setDescription("Envoie l'embed en DM à tous les membres du serveur")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON();

let dmRunning = false;

export async function executeMassDm(interaction) {
  if (dmRunning) {
    await interaction.reply({ content: "⏳ Un envoi est déjà en cours...", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  dmRunning = true;

  try {
    const guild  = interaction.guild;
    const all    = await guild.members.fetch();
    const humans = [...all.values()].filter((m) => !m.user.bot);

    await interaction.editReply(`📨 Envoi en cours à **${humans.length} membres**...`);

    let ok = 0, fail = 0;

    for (let i = 0; i < humans.length; i++) {
      const mbr = humans[i];

      const embed = new EmbedBuilder()
        .setTitle(EMBED_TITLE)
        .setDescription(EMBED_DESCRIPTION)
        .setColor(EMBED_COLOR)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(BUTTON_LABEL)
          .setURL(BUTTON_URL)
          .setStyle(ButtonStyle.Link),
      );

      try {
        await mbr.send({ embeds: [embed], components: [row] });
        ok++;
        console.log(`  ✔ ${mbr.user.tag}`);
      } catch {
        fail++;
        console.log(`  ✘ ${mbr.user.tag} (DMs fermés)`);
      }

      if ((i + 1) % 10 === 0) {
        await interaction.editReply(
          `📨 **${i + 1}/${humans.length}** — ✅ ${ok} envoyés | ❌ ${fail} échoués`,
        );
      }

      await new Promise((r) => setTimeout(r, 1200));
    }

    const done = new EmbedBuilder()
      .setTitle("✅ Mass DM terminé !")
      .setColor(0x57f287)
      .addFields(
        { name: "Total",      value: `${humans.length}`, inline: true },
        { name: "✅ Envoyés", value: `${ok}`,            inline: true },
        { name: "❌ Échecs",  value: `${fail}`,          inline: true },
      )
      .setFooter({ text: "Échecs = membres avec DMs désactivés" })
      .setTimestamp();

    await interaction.editReply({ content: "", embeds: [done] });
    console.log(`🎉 Mass DM terminé — Succès: ${ok} | Échecs: ${fail}`);
  } catch (err) {
    console.error("Erreur mass DM:", err);
    await interaction.editReply("❌ Erreur. Vérifie les logs Railway.");
  } finally {
    dmRunning = false;
  }
}

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const TOKEN    = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN)    { console.error("❌ DISCORD_BOT_TOKEN manquant");  process.exit(1); }
if (!GUILD_ID) { console.error("❌ DISCORD_GUILD_ID manquant");   process.exit(1); }

// ─── Config embed ─────────────────────────────────────────────────────────────
const EMBED_TITLE       = "VSEY #NEW";
const EMBED_DESCRIPTION = "VSEY EST UN NOUVEAU SERVEUR COMMUNAUTAIRE PRÊT À VOUS ACCUEILLIR , A VOUS ACCOMPAGNER DANS VOS PROJET , JOUER , PARLER , VOC EXT";
const EMBED_COLOR       = 0x5865f2;
const BUTTON_LABEL      = "JOIN";
const BUTTON_URL        = "https://discord.gg/zF6u4YWyWG";
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

let dmRunning = false;

client.once("ready", async () => {
  console.log("=================================");
  console.log(`✅ Bot prêt : ${client.user!.tag}`);
  console.log(`📡 GUILD_ID  : ${GUILD_ID}`);
  console.log("=================================");

  // Récupère l'Application ID directement depuis le client connecté
  const appId = client.application!.id;
  console.log(`🤖 APP_ID (auto) : ${appId}`);

  // Enregistre /dmall uniquement sur ce serveur (instantané)
  const rest = new REST().setToken(TOKEN!);
  try {
    const command = new SlashCommandBuilder()
      .setName("dmall")
      .setDescription("Envoie l'embed en DM à tous les membres du serveur")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON();

    await rest.put(
      Routes.applicationGuildCommands(appId, GUILD_ID!),
      { body: [command] },
    );
    console.log("✅ Commande /dmall enregistrée avec succès !");
  } catch (err) {
    console.error("❌ Erreur enregistrement commande :", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "dmall") return;

  if (dmRunning) {
    await interaction.reply({ content: "⏳ Un envoi est déjà en cours...", ephemeral: true });
    return;
  }

  await interaction.deferReply();
  dmRunning = true;

  try {
    const guild  = await client.guilds.fetch(GUILD_ID!);
    const all    = await guild.members.fetch();
    const humans = [...all.values()].filter((m) => !m.user.bot);

    await interaction.editReply(`📨 Envoi en cours à **${humans.length} membres**...`);

    let ok = 0, fail = 0;

    for (let i = 0; i < humans.length; i++) {
      const mbr = humans[i]!;

      const embed = new EmbedBuilder()
        .setTitle(EMBED_TITLE)
        .setDescription(EMBED_DESCRIPTION)
        .setColor(EMBED_COLOR)
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    console.log(`🎉 Terminé — Succès: ${ok} | Échecs: ${fail}`);
  } catch (err) {
    console.error("Erreur mass DM:", err);
    await interaction.editReply("❌ Erreur. Vérifie les logs Railway.");
  } finally {
    dmRunning = false;
  }
});

client.login(TOKEN);

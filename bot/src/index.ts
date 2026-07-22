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
  ChatInputCommandInteraction,
  InteractionResponse,
  Message as DiscordMessage,
} from "discord.js";

const TOKEN   = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN)     { console.error("❌ DISCORD_BOT_TOKEN manquant");  process.exit(1); }
if (!GUILD_ID)  { console.error("❌ DISCORD_GUILD_ID manquant");   process.exit(1); }
if (!CLIENT_ID) { console.error("❌ DISCORD_CLIENT_ID manquant");  process.exit(1); }

// ─── Config embed ─────────────────────────────────────────────────────────────
const EMBED_TITLE       = "VSEY #NEW";
const EMBED_DESCRIPTION = "VSEY EST UN NOUVEAU SERVEUR COMMUNAUTAIRE PRÊT À VOUS ACCUEILLIR , A VOUS ACCOMPAGNER DANS VOS PROJET , JOUER , PARLER , VOC EXT";
const EMBED_COLOR       = 0x5865f2;
const BUTTON_LABEL      = "JOIN";
const BUTTON_URL        = "https://discord.gg/zF6u4YWyWG";
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enregistrement de la slash command auprès de Discord ────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("dmall")
    .setDescription("Envoie l'embed en DM à tous les membres du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

const rest = new REST().setToken(TOKEN!);

async function registerCommands() {
  try {
    console.log("🔄 Enregistrement de la commande /dmall...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID!),
      { body: commands },
    );
    console.log("✅ Commande /dmall enregistrée sur le serveur.");
  } catch (err) {
    console.error("❌ Erreur lors de l'enregistrement des commandes :", err);
  }
}
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
  console.log(`🤖 CLIENT_ID : ${CLIENT_ID}`);
  console.log("=================================");
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "dmall") return;

  if (dmRunning) {
    await interaction.reply({ content: "⏳ Un envoi est déjà en cours...", ephemeral: true });
    return;
  }

  // Defer public pour pouvoir éditer le message ensuite
  await interaction.deferReply();

  dmRunning = true;

  try {
    const guild   = await client.guilds.fetch(GUILD_ID!);
    const all     = await guild.members.fetch();
    const humans  = [...all.values()].filter((m) => !m.user.bot);

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

      // Mise à jour toutes les 10 personnes
      if ((i + 1) % 10 === 0) {
        await interaction.editReply(
          `📨 **${i + 1}/${humans.length}** — ✅ ${ok} envoyés | ❌ ${fail} échoués`,
        );
      }

      // Pause anti rate-limit Discord
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
    await interaction.editReply("❌ Erreur pendant l'envoi. Vérifie les logs Railway.");
  } finally {
    dmRunning = false;
  }
});

client.login(TOKEN);

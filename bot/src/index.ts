import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const PREFIX = "+";

if (!TOKEN) { console.error("❌ DISCORD_BOT_TOKEN manquant"); process.exit(1); }
if (!GUILD_ID) { console.error("❌ DISCORD_GUILD_ID manquant"); process.exit(1); }

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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let dmRunning = false;

client.once("ready", () => {
  console.log("=================================");
  console.log(`✅ Bot prêt : ${client.user!.tag}`);
  console.log(`📡 GUILD_ID : ${GUILD_ID}`);
  console.log(`🎯 Préfixe  : "${PREFIX}"`);
  console.log("=================================");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content;
  console.log(`[MSG] ${message.author.tag}: ${content}`);

  if (!content.startsWith(PREFIX)) return;

  const cmd = content.slice(PREFIX.length).trim().split(/\s+/)[0]?.toLowerCase();
  console.log(`[CMD] Commande détectée: "${cmd}"`);

  // +ping
  if (cmd === "ping") {
    await message.reply(`🏓 Pong ! **${client.ws.ping}ms**`);
    return;
  }

  // +dmall
  if (cmd === "dmall") {
    const member = message.member!;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply("❌ Admin seulement.");
      return;
    }
    if (dmRunning) {
      await message.reply("⏳ Envoi déjà en cours...");
      return;
    }

    dmRunning = true;
    const status = await message.reply("🔄 Récupération des membres...");

    try {
      const guild  = await client.guilds.fetch(GUILD_ID!);
      const all    = await guild.members.fetch();
      const humans = [...all.values()].filter((m) => !m.user.bot);

      await status.edit(`📨 Envoi à **${humans.length} membres**...`);

      let ok = 0, fail = 0;

      for (let i = 0; i < humans.length; i++) {
        const mbr = humans[i]!;
        const embed = new EmbedBuilder()
          .setTitle(EMBED_TITLE)
          .setDescription(EMBED_DESCRIPTION)
          .setColor(EMBED_COLOR)
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel(BUTTON_LABEL).setURL(BUTTON_URL).setStyle(ButtonStyle.Link)
        );

        try {
          await mbr.send({ embeds: [embed], components: [row] });
          ok++;
          console.log(`  ✔ ${mbr.user.tag}`);
        } catch {
          fail++;
          console.log(`  ✘ ${mbr.user.tag}`);
        }

        if ((i + 1) % 10 === 0) {
          await status.edit(`📨 **${i + 1}/${humans.length}** — ✅ ${ok} | ❌ ${fail}`);
        }

        await new Promise((r) => setTimeout(r, 1200));
      }

      const done = new EmbedBuilder()
        .setTitle("✅ Mass DM terminé !")
        .setColor(0x57f287)
        .addFields(
          { name: "Total",       value: `${humans.length}`, inline: true },
          { name: "✅ Envoyés",  value: `${ok}`,            inline: true },
          { name: "❌ Échecs",   value: `${fail}`,           inline: true },
        )
        .setFooter({ text: "Échecs = DMs désactivés" })
        .setTimestamp();

      await status.edit({ content: "", embeds: [done] });
    } catch (err) {
      console.error("Erreur mass DM:", err);
      await status.edit("❌ Erreur. Vérifie les logs Railway.");
    } finally {
      dmRunning = false;
    }
  }
});

client.login(TOKEN);

import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { handleAntiLink, antilinkEnabled, enableAntilink, disableAntilink } from "./handlers/antilink.js";
import { executeBan }       from "./commands/ban.js";
import { executeUnban }     from "./commands/unban.js";
import { executeMute }      from "./commands/mute.js";
import { executeUnmute }    from "./commands/unmute.js";
import { executeClear }     from "./commands/clear.js";
import { executeSmashPass } from "./commands/smashpass.js";

const PREFIX = process.env.PREFIX || "!";
const TOKEN  = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error("[ERREUR] DISCORD_TOKEN manquant dans .env"); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ ${c.user.tag} en ligne !`);
  console.log(`📌 Préfixe : ${PREFIX}`);
  console.log(`🔗 Serveurs avec anti-lien actif au démarrage : ${antilinkEnabled.size}`);
  c.user.setActivity("🛡️ CASTEL PROTECT | " + PREFIX + "help");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // ── Anti-lien (persistant via fichier JSON) ────────────────────────────────
  if (antilinkEnabled.has(message.guild.id)) {
    const deleted = await handleAntiLink(message);
    if (deleted) return;
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args    = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    switch (command) {

      case "help":
        await message.channel.send({ embeds: [{ color: 0x5865f2, title: "🛡️ CASTEL PROTECT — Commandes", description: `Préfixe : \`${PREFIX}\``, fields: [
          { name: "🔗 Anti-lien", value: `\`${PREFIX}antilink on\` — Activer\n\`${PREFIX}antilink off\` — Désactiver\n\`${PREFIX}antilink status\` — État` },
          { name: "🔨 Modération", value: `\`${PREFIX}ban @user [raison]\`\n\`${PREFIX}unban <ID> [raison]\`\n\`${PREFIX}mute @user [durée] [raison]\` _(10m, 2h, 1d…)_\n\`${PREFIX}unmute @user\`\n\`${PREFIX}clear [nombre]\` — illimité si vide` },
          { name: "🎮 Fun", value: `\`${PREFIX}sop [sujet]\` — Smash or Pass aléatoire ou sur un sujet personnalisé` },
        ], footer: { text: "CASTEL PROTECT • Modération" }, timestamp: new Date().toISOString() }] });
        break;

      case "antilink": {
        if (!message.member.permissions.has("ManageGuild"))
          return message.reply("❌ Permission `Gérer le serveur` requise.");
        const sub = (args[0] || "").toLowerCase();
        if (sub === "on") {
          enableAntilink(message.guild.id);
          await message.reply("✅ Anti-lien **activé** et sauvegardé — actif même après redémarrage.");
        } else if (sub === "off") {
          disableAntilink(message.guild.id);
          await message.reply("🔓 Anti-lien **désactivé**.");
        } else if (sub === "status") {
          const on = antilinkEnabled.has(message.guild.id);
          await message.reply(`🔗 Anti-lien : ${on ? "**✅ Activé**" : "**❌ Désactivé**"}`);
        } else {
          await message.reply(`Usage : \`${PREFIX}antilink on/off/status\``);
        }
        break;
      }

      case "ban":    await executeBan(message, args, PREFIX);       break;
      case "unban":  await executeUnban(message, args, PREFIX);     break;
      case "mute":   await executeMute(message, args, PREFIX);      break;
      case "unmute": await executeUnmute(message, args, PREFIX);    break;
      case "clear":  await executeClear(message, args, PREFIX);     break;
      case "sop":
      case "smashpass":
        await executeSmashPass(message, args, PREFIX);
        break;
    }
  } catch (err) {
    console.error(`[ERREUR ${command}]`, err);
    message.reply("❌ Erreur interne.").catch(() => {});
  }
});

client.login(TOKEN);

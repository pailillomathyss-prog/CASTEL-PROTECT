import "dotenv/config";
import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import { handleAntiLink, antilinkEnabled, enableAntilink, disableAntilink } from "./handlers/antilink.js";
import { executeBan }         from "./commands/ban.js";
import { executeUnban }       from "./commands/unban.js";
import { executeMute }        from "./commands/mute.js";
import { executeUnmute }      from "./commands/unmute.js";
import { executeClear }       from "./commands/clear.js";
import { executeSmashPass }   from "./commands/smashpass.js";
import { executeTicketSetup, createTicket, closeTicket } from "./commands/ticket.js";
import {
  executeSopPhotoSetup,
  handleSopSubmitButton,
  handleSopModeChoice,
  handleSopDm,
  handleSopVote,
} from "./commands/sopphoto.js";

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
    GatewayIntentBits.DirectMessages,        // Pour recevoir les photos en DM
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,   // Obligatoire pour les DMs
    Partials.Message,
  ],
});

// ─── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, (c) => {
  console.log(`✅ ${c.user.tag} en ligne !`);
  console.log(`📌 Préfixe : ${PREFIX}`);
  console.log(`🔗 Serveurs avec anti-lien actif : ${antilinkEnabled.size}`);
  c.user.setActivity("🛡️ CASTEL PROTECT | " + PREFIX + "help");
});

// ─── Messages ──────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  // ── DM → réception photo Smash or Pass ────────────────────────────────────
  if (!message.guild && !message.author.bot) {
    await handleSopDm(message, client);
    return;
  }

  if (message.author.bot || !message.guild) return;

  // ── Anti-lien ──────────────────────────────────────────────────────────────
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
        await message.channel.send({
          embeds: [{
            color: 0x5865f2,
            title: "🛡️ CASTEL PROTECT — Commandes",
            description: `Préfixe : \`${PREFIX}\``,
            fields: [
              {
                name: "🔗 Anti-lien",
                value:
                  `\`${PREFIX}antilink on\` — Activer\n` +
                  `\`${PREFIX}antilink off\` — Désactiver\n` +
                  `\`${PREFIX}antilink status\` — État`,
              },
              {
                name: "🔨 Modération",
                value:
                  `\`${PREFIX}ban @user [raison]\`\n` +
                  `\`${PREFIX}unban <ID> [raison]\`\n` +
                  `\`${PREFIX}mute @user [durée] [raison]\` _(10m, 2h, 1d…)_\n` +
                  `\`${PREFIX}unmute @user\`\n` +
                  `\`${PREFIX}clear [nombre]\` — illimité si vide`,
              },
              {
                name: "🎫 Tickets",
                value: `\`${PREFIX}ticket setup [#salon]\``,
              },
              {
                name: "📸 Smash or Pass Photos",
                value: `\`${PREFIX}sopphoto setup #panel #votes\` — Configurer le système`,
              },
              {
                name: "🎮 Fun",
                value: `\`${PREFIX}sop [sujet]\` — Smash or Pass texte`,
              },
            ],
            footer: { text: "CASTEL PROTECT • Modération & Fun" },
            timestamp: new Date().toISOString(),
          }],
        });
        break;

      case "antilink": {
        if (!message.member.permissions.has("ManageGuild"))
          return message.reply("❌ Permission `Gérer le serveur` requise.");
        const sub = (args[0] || "").toLowerCase();
        if (sub === "on") {
          enableAntilink(message.guild.id);
          await message.reply("✅ Anti-lien **activé** et sauvegardé.");
        } else if (sub === "off") {
          disableAntilink(message.guild.id);
          await message.reply("🔓 Anti-lien **désactivé**.");
        } else if (sub === "status") {
          await message.reply(`🔗 Anti-lien : ${antilinkEnabled.has(message.guild.id) ? "**✅ Activé**" : "**❌ Désactivé**"}`);
        } else {
          await message.reply(`Usage : \`${PREFIX}antilink on/off/status\``);
        }
        break;
      }

      case "ban":    await executeBan(message, args, PREFIX);    break;
      case "unban":  await executeUnban(message, args, PREFIX);  break;
      case "mute":   await executeMute(message, args, PREFIX);   break;
      case "unmute": await executeUnmute(message, args, PREFIX); break;
      case "clear":  await executeClear(message, args, PREFIX);  break;

      case "ticket":
        if ((args[0] || "").toLowerCase() === "setup") {
          await executeTicketSetup(message, args.slice(1), PREFIX);
        } else {
          await message.reply(`Usage : \`${PREFIX}ticket setup [#salon]\``);
        }
        break;

      case "sopphoto":
        if ((args[0] || "").toLowerCase() === "setup") {
          await executeSopPhotoSetup(message, args.slice(1), PREFIX);
        } else {
          await message.reply(`Usage : \`${PREFIX}sopphoto setup #panel #votes\``);
        }
        break;

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

// ─── Interactions (boutons) ────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const id = interaction.customId;

  try {
    // ── Tickets ───────────────────────────────────────────────────────────────
    if (id === "ticket_rankup")    return await createTicket(interaction, "rankup");
    if (id === "ticket_bugreport") return await createTicket(interaction, "bugreport");
    if (id === "ticket_autre")     return await createTicket(interaction, "autre");
    if (id === "ticket_close")     return await closeTicket(interaction);

    // ── Smash or Pass Photos ──────────────────────────────────────────────────
    if (id === "sop_submit")       return await handleSopSubmitButton(interaction);
    if (id === "sop_anon")         return await handleSopModeChoice(interaction, true);
    if (id === "sop_public")       return await handleSopModeChoice(interaction, false);

    if (id.startsWith("sop_smash_")) {
      const sessionId = id.replace("sop_smash_", "");
      return await handleSopVote(interaction, "smash", sessionId);
    }
    if (id.startsWith("sop_pass_")) {
      const sessionId = id.replace("sop_pass_", "");
      return await handleSopVote(interaction, "pass", sessionId);
    }
  } catch (err) {
    console.error("[ERREUR interaction]", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "❌ Erreur interne.", ephemeral: true }).catch(() => {});
    }
  }
});

// ─── Connexion ─────────────────────────────────────────────────────────────────
client.login(TOKEN);

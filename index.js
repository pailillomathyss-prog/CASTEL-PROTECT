import "dotenv/config";
import { Client, GatewayIntentBits, Events, Partials, REST, Routes } from "discord.js";
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
import {
  executeGiveaway,
  handleGiveawayJoin,
  resumeGiveaways,
} from "./commands/giveaway.js";
import {
  executeVocalSetup,
  executeVocalRename,
  executeVocalLimit,
  executeVocalLock,
  executeVocalUnlock,
  executeVocalKick,
  handleVoiceStateUpdate,
} from "./handlers/autovocal.js";
import { massDmCommand, executeMassDm } from "./commands/massdm.js";
import { executeRolePanel, handleRoleButton } from "./commands/rolepanel.js";

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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
});

// ─── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ${c.user.tag} en ligne !`);
  console.log(`📌 Préfixe : ${PREFIX}`);
  c.user.setActivity("🛡️ CASTEL PROTECT | " + PREFIX + "help");
  resumeGiveaways(c);

  // ── Enregistrement de /dmall sur tous les serveurs du bot ─────────────────
  try {
    const rest = new REST().setToken(TOKEN);
    for (const [guildId] of c.guilds.cache) {
      await rest.put(
        Routes.applicationGuildCommands(c.application.id, guildId),
        { body: [massDmCommand] },
      );
      console.log(`✅ /dmall enregistré sur le serveur ${guildId}`);
    }
  } catch (err) {
    console.error("❌ Erreur enregistrement /dmall :", err);
  }
});

// ─── Vocal auto ────────────────────────────────────────────────────────────────
client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);

// ─── Messages ──────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }
  if (message.channel.partial) {
    try { await message.channel.fetch(); } catch { return; }
  }
  if (!message.author) return;

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
                value: `\`${PREFIX}antilink on/off/status\``,
              },
              {
                name: "🔨 Modération",
                value:
                  `\`${PREFIX}ban @user [raison]\`\n` +
                  `\`${PREFIX}unban <ID> [raison]\`\n` +
                  `\`${PREFIX}mute @user [raison]\`\n` +
                  `\`${PREFIX}unmute @user\`\n` +
                  `\`${PREFIX}clear <nombre>\``,
              },
              {
                name: "🎫 Tickets",
                value: `\`${PREFIX}ticket setup #salon\``,
              },
              {
                name: "🎉 Giveaway",
                value: `\`${PREFIX}giveaway <durée> <nb gagnants> <prix>\``,
              },
              {
                name: "🔊 Vocal auto",
                value:
                  `\`${PREFIX}vocal setup #salon\`\n` +
                  `\`${PREFIX}vocal rename <nom>\`\n` +
                  `\`${PREFIX}vocal limit <nb>\`\n` +
                  `\`${PREFIX}vocal lock/unlock\`\n` +
                  `\`${PREFIX}vocal kick @user\``,
              },
              {
                name: "📸 Smash or Pass",
                value: `\`${PREFIX}sopphoto setup #panel #votes\``,
              },
              {
                name: "📨 Mass DM",
                value: `\`/dmall\` — Envoie un DM embed à tous les membres (admin)`,
              },
            ],
          }],
        });
        break;

      case "antilink":
        if (args[0] === "on")     { enableAntilink(message.guild.id);  await message.reply("✅ Anti-lien activé.");   }
        else if (args[0] === "off")    { disableAntilink(message.guild.id); await message.reply("✅ Anti-lien désactivé."); }
        else if (args[0] === "status") { await message.reply(antilinkEnabled.has(message.guild.id) ? "🟢 Anti-lien activé." : "🔴 Anti-lien désactivé."); }
        else                           { await message.reply(`Usage : \`${PREFIX}antilink on/off/status\``); }
        break;

      case "ban":
        await executeBan(message, args);
        break;

      case "unban":
        await executeUnban(message, args);
        break;

      case "mute":
        await executeMute(message, args);
        break;

      case "unmute":
        await executeUnmute(message, args);
        break;

      case "clear":
        await executeClear(message, args);
        break;

      case "ticket":
        if (args[0] === "setup") await executeTicketSetup(message, args.slice(1));
        else await message.reply(`Usage : \`${PREFIX}ticket setup #salon\``);
        break;

      case "giveaway":
        await executeGiveaway(message, args);
        break;

      case "vocal":
        switch (args[0]) {
          case "setup":   await executeVocalSetup(message, args.slice(1));  break;
          case "rename":  await executeVocalRename(message, args.slice(1)); break;
          case "limit":   await executeVocalLimit(message, args.slice(1));  break;
          case "lock":    await executeVocalLock(message);                  break;
          case "unlock":  await executeVocalUnlock(message);                break;
          case "kick":    await executeVocalKick(message, args.slice(1));   break;
          default: await message.reply(`Usage : \`${PREFIX}vocal setup/rename/limit/lock/unlock/kick\``);
        }
        break;

      case "sopphoto":
        if (args[0] === "setup") {
          await executeSopPhotoSetup(message, args.slice(1), PREFIX);
        } else {
          await message.reply(`Usage : \`${PREFIX}sopphoto setup #panel #votes\``);
        }
        break;

      case "sop":
      case "smashpass":
        await executeSmashPass(message, args, PREFIX);
        break;

      case "rolepanel":
        if (args[0] === "setup") await executeRolePanel(message);
        else await message.reply(`Usage : \`${PREFIX}rolepanel setup\``);
        break;
    }
  } catch (err) {
    console.error(`[ERREUR ${command}]`, err);
    message.reply("❌ Erreur interne.").catch(() => {});
  }
});

// ─── Interactions (slash commands + boutons) ───────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "dmall") {
        await executeMassDm(interaction);
      }
      return;
    }

    // ── Boutons ───────────────────────────────────────────────────────────────
    if (!interaction.isButton()) return;
    const id = interaction.customId;

    if (id === "ticket_rankup")    return await createTicket(interaction, "rankup");
    if (id === "ticket_bugreport") return await createTicket(interaction, "bugreport");
    if (id === "ticket_autre")     return await createTicket(interaction, "autre");
    if (id === "ticket_close")     return await closeTicket(interaction);

    if (id === "sop_submit")       return await handleSopSubmitButton(interaction);
    if (id === "sop_anon")         return await handleSopModeChoice(interaction, true);
    if (id === "sop_public")       return await handleSopModeChoice(interaction, false);
    if (id.startsWith("sop_smash_")) return await handleSopVote(interaction, "smash", id.replace("sop_smash_", ""));
    if (id.startsWith("sop_pass_"))  return await handleSopVote(interaction, "pass",  id.replace("sop_pass_", ""));

    if (id.startsWith("gw_join_"))  return await handleGiveawayJoin(interaction, id.replace("gw_join_", ""));

    // ── Panel de rôles ────────────────────────────────────────────────────────
    if (id.startsWith("role_"))     return await handleRoleButton(interaction);

  } catch (err) {
    console.error("[ERREUR interaction]", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "❌ Erreur interne.", ephemeral: true }).catch(() => {});
    }
  }
});

// ─── Connexion ─────────────────────────────────────────────────────────────────
client.login(TOKEN);

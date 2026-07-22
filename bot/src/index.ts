import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type Message,
  type GuildMember,
} from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const PREFIX = '+';

if (!TOKEN || !GUILD_ID) {
  console.error('❌ Variables manquantes : DISCORD_BOT_TOKEN et DISCORD_GUILD_ID requis.');
  process.exit(1);
}

// ─── Configuration de l'embed ────────────────────────────────────────────────
const EMBED_TITLE = 'VSEY #NEW';
const EMBED_DESCRIPTION =
  'VSEY EST UN NOUVEAU SERVEUR COMMUNAUTAIRE PRÊT À VOUS ACCUEILLIR , A VOUS ACCOMPAGNER DANS VOS PROJET , JOUER , PARLER , VOC EXT';
const EMBED_COLOR = 0x5865f2;
const BUTTON_LABEL = 'JOIN';
const BUTTON_URL = 'https://discord.gg/zF6u4YWyWG';
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,  // ← Privileged intent : doit être activé dans le Developer Portal
  ],
});

const buildEmbed = () =>
  new EmbedBuilder()
    .setTitle(EMBED_TITLE)
    .setDescription(EMBED_DESCRIPTION)
    .setColor(EMBED_COLOR)
    .setTimestamp();

const buildRow = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(BUTTON_LABEL)
      .setURL(BUTTON_URL)
      .setStyle(ButtonStyle.Link),
  );

let dmRunning = false;

client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user?.tag}`);
  console.log(`📡 Guild ID configuré : ${GUILD_ID}`);
  console.log(`🎯 Préfixe : "${PREFIX}"`);
  console.log(`📌 Commandes disponibles : ${PREFIX}ping, ${PREFIX}dmall`);
});

// Log chaque message reçu pour debug (désactiver en prod si besoin)
client.on('messageCreate', async (message: Message) => {
  // Ignore les bots et les DMs
  if (message.author.bot) return;
  if (!message.guild) return;

  console.log(`[MSG] ${message.author.tag} dans #${(message.channel as { name?: string }).name ?? 'inconnu'} : ${message.content}`);

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0]?.toLowerCase();

  // ── +ping — commande de test ───────────────────────────────────────────────
  if (command === 'ping') {
    await message.reply(`🏓 Pong ! Latence : **${client.ws.ping}ms**`);
    return;
  }

  // ── +dmall — envoi du DM à tous les membres ───────────────────────────────
  if (command === 'dmall') {
    const member = message.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('❌ Tu dois être **administrateur** pour utiliser cette commande.');
      return;
    }

    if (dmRunning) {
      await message.reply('⏳ Un envoi de DM est déjà en cours, patiente...');
      return;
    }

    dmRunning = true;
    const statusMsg = await message.reply('🔄 Récupération des membres...');

    try {
      const guild = await client.guilds.fetch(GUILD_ID!);
      const members = await guild.members.fetch();
      const humans = members.filter((m) => !m.user.bot);

      await statusMsg.edit(
        `📨 Envoi en cours à **${humans.size} membres**... (≈${Math.ceil((humans.size * 1.2) / 60)} min)`,
      );

      let success = 0;
      let failed = 0;
      let i = 0;

      for (const [, mbr] of humans) {
        i++;
        try {
          await mbr.send({ embeds: [buildEmbed()], components: [buildRow()] });
          success++;
          console.log(`  ✔ ${mbr.user.tag}`);
        } catch {
          failed++;
          console.log(`  ✘ ${mbr.user.tag} (DMs fermés)`);
        }
        if (i % 10 === 0) {
          await statusMsg.edit(
            `📨 Progression : **${i}/${humans.size}** — ✅ ${success} envoyés, ❌ ${failed} échoués`,
          );
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle('✅ Mass DM terminé !')
        .setColor(0x57f287)
        .addFields(
          { name: 'Total', value: `${humans.size}`, inline: true },
          { name: '✅ Envoyés', value: `${success}`, inline: true },
          { name: '❌ Échecs', value: `${failed}`, inline: true },
        )
        .setFooter({ text: 'Échecs = membres avec les DMs désactivés' })
        .setTimestamp();

      await statusMsg.edit({ content: '', embeds: [resultEmbed] });
      console.log(`🎉 Terminé — Succès: ${success} | Échecs: ${failed}`);
    } catch (err) {
      console.error('Erreur pendant le mass DM:', err);
      await statusMsg.edit('❌ Erreur pendant l\'envoi. Vérifie les logs Railway.');
    } finally {
      dmRunning = false;
    }
  }
});

client.login(TOKEN);

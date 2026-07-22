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
  console.error('❌ Variables manquantes : DISCORD_BOT_TOKEN et DISCORD_GUILD_ID sont requis.');
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
    GatewayIntentBits.MessageContent,
  ],
});

// Build embed + button une seule fois
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

// Garde en mémoire si un dmall est en cours pour éviter les doublons
let dmRunning = false;

client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user?.tag}`);
  console.log(`📡 Serveur cible : ${GUILD_ID}`);
});

client.on('messageCreate', async (message: Message) => {
  // Ignore les bots
  if (message.author.bot) return;
  // Vérifie le préfixe
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0]?.toLowerCase();

  if (command !== 'dmall') return;

  // ── Vérification des permissions (admin uniquement) ──────────────────────
  const member = message.member as GuildMember;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply('❌ Tu dois être **administrateur** pour utiliser cette commande.');
    return;
  }

  if (dmRunning) {
    await message.reply('⏳ Un envoi de DM est déjà en cours, patiente...');
    return;
  }

  // ── Démarrage de l'envoi ─────────────────────────────────────────────────
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
      } catch {
        failed++;
      }
      // Mise à jour de progression toutes les 10 personnes
      if (i % 10 === 0) {
        await statusMsg.edit(
          `📨 Progression : **${i}/${humans.size}** — ✅ ${success} envoyés, ❌ ${failed} échoués`,
        );
      }
      // Pause anti-rate-limit
      await new Promise((r) => setTimeout(r, 1200));
    }

    // ── Résumé final ───────────────────────────────────────────────────────
    const resultEmbed = new EmbedBuilder()
      .setTitle('✅ Mass DM terminé !')
      .setColor(0x57f287)
      .addFields(
        { name: 'Total', value: `${humans.size}`, inline: true },
        { name: '✅ Envoyés', value: `${success}`, inline: true },
        { name: '❌ Échecs', value: `${failed}`, inline: true },
      )
      .setFooter({ text: 'Les échecs = membres avec les DMs désactivés' })
      .setTimestamp();

    await statusMsg.edit({ content: '', embeds: [resultEmbed] });
    console.log(`🎉 Mass DM terminé — Succès: ${success} | Échecs: ${failed}`);
  } catch (err) {
    console.error('Erreur pendant le mass DM:', err);
    await statusMsg.edit('❌ Erreur pendant l\'envoi. Vérifie les logs.');
  } finally {
    dmRunning = false;
  }
});

client.login(TOKEN);

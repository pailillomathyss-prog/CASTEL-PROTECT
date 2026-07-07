/**
 * !mute @user [durée] [raison]
 * Met un membre en sourdine via le timeout Discord.
 * Durée : 10s, 5m, 2h, 1d, 1w (max 28 jours)
 */

/**
 * Parse une durée textuelle en millisecondes.
 * Formats acceptés : 30s, 10m, 2h, 1d, 1w
 * @param {string} str
 * @returns {number|null}
 */
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * units[unit];
}

/**
 * Formate une durée ms en texte lisible.
 */
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} seconde(s)`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute(s)`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} heure(s)`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} jour(s)`;
  return `${Math.floor(d / 7)} semaine(s)`;
}

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 jours (limite Discord)

export async function executeMute(message, args, PREFIX) {
  // Permission
  if (!message.member.permissions.has("ModerateMembers")) {
    return message.reply("❌ Tu n'as pas la permission `Exclure temporairement des membres`.");
  }

  if (!message.guild.members.me.permissions.has("ModerateMembers")) {
    return message.reply("❌ Je n'ai pas la permission de mettre en sourdine.");
  }

  // Cible
  const target =
    message.mentions.members.first() ||
    (args[0] && !/^\d+[smhdw]$/i.test(args[0])
      ? await message.guild.members.fetch(args[0]).catch(() => null)
      : null);

  if (!target) {
    return message.reply(
      `❌ Mentionne un membre ou indique son ID.\nUsage : \`${PREFIX}mute @user [durée] [raison]\`\nExemples de durée : \`10m\`, \`2h\`, \`1d\`, \`1w\``
    );
  }

  if (target.id === message.author.id) {
    return message.reply("❌ Tu ne peux pas te mute toi-même.");
  }

  if (target.id === message.guild.ownerId) {
    return message.reply("❌ Impossible de mute le propriétaire du serveur.");
  }

  if (!target.moderatable) {
    return message.reply("❌ Je ne peux pas mute ce membre (rôle supérieur au mien).");
  }

  // Récupérer durée et raison depuis les args restants
  const remainingArgs = args.filter((a) => a !== target.toString() && !a.startsWith("<@"));
  
  let durationStr = null;
  let reasonStart = 0;

  if (remainingArgs[0] && /^\d+[smhdw]$/i.test(remainingArgs[0])) {
    durationStr = remainingArgs[0];
    reasonStart = 1;
  }

  const durationMs = durationStr ? parseDuration(durationStr) : 10 * 60 * 1000; // Défaut : 10 min
  const raison = remainingArgs.slice(reasonStart).join(" ") || "Aucune raison fournie";

  if (!durationMs) {
    return message.reply("❌ Durée invalide. Exemples valides : `10s`, `5m`, `2h`, `1d`, `1w`");
  }

  if (durationMs > MAX_TIMEOUT_MS) {
    return message.reply("❌ La durée maximale est de **28 jours**.");
  }

  try {
    await target.timeout(durationMs, `${message.author.tag} : ${raison}`);

    // Notifier en DM
    await target.user
      .send({
        embeds: [
          {
            color: 0xff9800,
            title: `🔇 Tu as été mis en sourdine sur **${message.guild.name}**`,
            fields: [
              { name: "Durée", value: formatDuration(durationMs) },
              { name: "Raison", value: raison },
              { name: "Modérateur", value: message.author.tag },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .catch(() => {});

    await message.reply({
      embeds: [
        {
          color: 0xff9800,
          title: "🔇 Membre mis en sourdine",
          fields: [
            { name: "Membre", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Modérateur", value: message.author.tag, inline: true },
            { name: "Durée", value: formatDuration(durationMs), inline: true },
            { name: "Raison", value: raison },
          ],
          footer: { text: "CASTEL PROTECT • Modération" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("[mute]", err);
    await message.reply("❌ Erreur lors du mute.");
  }
}

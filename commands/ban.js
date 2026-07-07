/**
 * !ban @user [raison]
 * Bannit un membre du serveur.
 */
export async function executeBan(message, args, PREFIX) {
  // Permission
  if (!message.member.permissions.has("BanMembers")) {
    return message.reply("❌ Tu n'as pas la permission `Bannir des membres`.");
  }

  if (!message.guild.members.me.permissions.has("BanMembers")) {
    return message.reply("❌ Je n'ai pas la permission de bannir des membres.");
  }

  // Cible
  const target =
    message.mentions.members.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!target) {
    return message.reply(`❌ Mentionne un membre ou indique son ID.\nUsage : \`${PREFIX}ban @user [raison]\``);
  }

  if (target.id === message.author.id) {
    return message.reply("❌ Tu ne peux pas te bannir toi-même.");
  }

  if (target.id === message.guild.ownerId) {
    return message.reply("❌ Impossible de bannir le propriétaire du serveur.");
  }

  if (!target.bannable) {
    return message.reply("❌ Je ne peux pas bannir ce membre (rôle supérieur au mien).");
  }

  const raison = args.slice(1).join(" ") || "Aucune raison fournie";

  try {
    await target.ban({ reason: `${message.author.tag} : ${raison}` });

    // Notifier l'utilisateur en DM
    await target.user
      .send({
        embeds: [
          {
            color: 0xff0000,
            title: `🔨 Tu as été banni de **${message.guild.name}**`,
            fields: [
              { name: "Raison", value: raison },
              { name: "Modérateur", value: message.author.tag },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .catch(() => {}); // Le DM peut être fermé

    await message.reply({
      embeds: [
        {
          color: 0xff0000,
          title: "🔨 Membre banni",
          fields: [
            { name: "Membre", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Modérateur", value: message.author.tag, inline: true },
            { name: "Raison", value: raison },
          ],
          footer: { text: "CASTEL PROTECT • Modération" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("[ban]", err);
    await message.reply("❌ Erreur lors du bannissement.");
  }
}

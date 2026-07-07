/**
 * !unmute @user
 * Retire le timeout (sourdine) d'un membre.
 */
export async function executeUnmute(message, args, PREFIX) {
  // Permission
  if (!message.member.permissions.has("ModerateMembers")) {
    return message.reply("❌ Tu n'as pas la permission `Exclure temporairement des membres`.");
  }

  if (!message.guild.members.me.permissions.has("ModerateMembers")) {
    return message.reply("❌ Je n'ai pas la permission de retirer les sourdines.");
  }

  // Cible
  const target =
    message.mentions.members.first() ||
    (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

  if (!target) {
    return message.reply(`❌ Mentionne un membre ou indique son ID.\nUsage : \`${PREFIX}unmute @user\``);
  }

  // Vérifier que le membre est bien en timeout
  if (!target.communicationDisabledUntil || target.communicationDisabledUntil < new Date()) {
    return message.reply("❌ Ce membre n'est pas en sourdine.");
  }

  if (!target.moderatable) {
    return message.reply("❌ Je ne peux pas modifier ce membre (rôle supérieur au mien).");
  }

  try {
    await target.timeout(null, `Sourdine retirée par ${message.author.tag}`);

    // Notifier en DM
    await target.user
      .send({
        embeds: [
          {
            color: 0x00c851,
            title: `🔊 Ta sourdine a été retirée sur **${message.guild.name}**`,
            fields: [
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
          color: 0x00c851,
          title: "🔊 Sourdine retirée",
          fields: [
            { name: "Membre", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Modérateur", value: message.author.tag, inline: true },
          ],
          footer: { text: "CASTEL PROTECT • Modération" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("[unmute]", err);
    await message.reply("❌ Erreur lors du retrait de la sourdine.");
  }
}

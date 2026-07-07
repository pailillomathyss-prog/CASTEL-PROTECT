/**
 * !unban <userID> [raison]
 * Débannit un utilisateur du serveur.
 */
export async function executeUnban(message, args, PREFIX) {
  // Permission
  if (!message.member.permissions.has("BanMembers")) {
    return message.reply("❌ Tu n'as pas la permission `Bannir des membres`.");
  }

  if (!message.guild.members.me.permissions.has("BanMembers")) {
    return message.reply("❌ Je n'ai pas la permission de débannir des membres.");
  }

  const userId = args[0];

  if (!userId || !/^\d{17,20}$/.test(userId)) {
    return message.reply(
      `❌ Indique un ID utilisateur valide.\nUsage : \`${PREFIX}unban <userID> [raison]\`\n\nTrouve l'ID dans **Paramètres du serveur → Bans**.`
    );
  }

  const raison = args.slice(1).join(" ") || "Aucune raison fournie";

  try {
    // Vérifier que l'utilisateur est bien banni
    const bans = await message.guild.bans.fetch();
    const bannedUser = bans.get(userId);

    if (!bannedUser) {
      return message.reply("❌ Cet utilisateur n'est pas banni sur ce serveur.");
    }

    await message.guild.members.unban(userId, `${message.author.tag} : ${raison}`);

    await message.reply({
      embeds: [
        {
          color: 0x00c851,
          title: "✅ Membre débanni",
          fields: [
            { name: "Membre", value: `${bannedUser.user.tag} (${userId})`, inline: true },
            { name: "Modérateur", value: message.author.tag, inline: true },
            { name: "Raison", value: raison },
          ],
          footer: { text: "CASTEL PROTECT • Modération" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("[unban]", err);
    await message.reply("❌ Erreur lors du débannissement. Vérifie que l'ID est correct.");
  }
}

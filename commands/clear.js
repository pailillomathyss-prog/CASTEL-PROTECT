export async function executeClear(message, args, PREFIX) {
  if (!message.member.permissions.has("ManageMessages"))
    return message.reply("❌ Permission `Gérer les messages` requise.");
  if (!message.guild.members.me.permissions.has("ManageMessages"))
    return message.reply("❌ Je n'ai pas la permission de supprimer des messages.");

  const requested = args[0] ? parseInt(args[0], 10) : 0;
  if (args[0] && (isNaN(requested) || requested < 0))
    return message.reply(`Usage : \`${PREFIX}clear [nombre]\``);

  await message.delete().catch(() => {});

  const unlimited = requested === 0;
  let remaining = requested, totalDeleted = 0;

  try {
    while (unlimited || remaining > 0) {
      const toFetch = unlimited ? 100 : Math.min(remaining, 100);
      const fetched = await message.channel.messages.fetch({ limit: toFetch });
      if (fetched.size === 0) break;
      const deleted = await message.channel.bulkDelete(fetched, true);
      totalDeleted += deleted.size;
      if (!unlimited) remaining -= deleted.size;
      if (deleted.size < toFetch) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    const m = await message.channel.send({ embeds: [{ color: 0x5865f2, title: "🧹 Messages supprimés", description: `**${totalDeleted}** message(s) supprimé(s)${unlimited ? " (mode illimité)" : ""}.`, footer: { text: "CASTEL PROTECT • Clear" }, timestamp: new Date().toISOString() }] });
    setTimeout(() => m.delete().catch(() => {}), 4000);
  } catch (err) {
    console.error("[clear]", err);
    message.channel.send("❌ Erreur lors de la suppression.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
  }
}

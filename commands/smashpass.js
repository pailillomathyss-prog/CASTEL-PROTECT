import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";

const TOPICS = [
  { label: "Pizza 🍕", cat: "Nourriture" },
  { label: "Sushi 🍣", cat: "Nourriture" },
  { label: "Tacos 🌮", cat: "Nourriture" },
  { label: "Raclette 🧀", cat: "Nourriture" },
  { label: "Ananas sur pizza 🍍", cat: "Nourriture" },
  { label: "Escargots 🐌", cat: "Nourriture" },
  { label: "Nuggets 🍗", cat: "Nourriture" },
  { label: "Ramen 🍜", cat: "Nourriture" },
  { label: "Kebab 🥙", cat: "Nourriture" },
  { label: "Bubble Tea 🧋", cat: "Nourriture" },
  { label: "Cornichons 🥒", cat: "Nourriture" },
  { label: "Chocolat noir 🍫", cat: "Nourriture" },
  { label: "Minecraft ⛏️", cat: "Jeux" },
  { label: "Fortnite 🏹", cat: "Jeux" },
  { label: "Among Us 🚀", cat: "Jeux" },
  { label: "GTA VI 🚗", cat: "Jeux" },
  { label: "League of Legends ⚔️", cat: "Jeux" },
  { label: "Valorant 🔫", cat: "Jeux" },
  { label: "FIFA 2025 ⚽", cat: "Jeux" },
  { label: "Mario Kart 🏎️", cat: "Jeux" },
  { label: "Elden Ring 🗡️", cat: "Jeux" },
  { label: "Paris 🗼", cat: "Voyage" },
  { label: "Tokyo 🏯", cat: "Voyage" },
  { label: "New York 🗽", cat: "Voyage" },
  { label: "Dubai 🏙️", cat: "Voyage" },
  { label: "Ibiza 🏖️", cat: "Voyage" },
  { label: "Las Vegas 🎰", cat: "Voyage" },
  { label: "Naruto 🍥", cat: "Anime" },
  { label: "Dragon Ball Z 💥", cat: "Anime" },
  { label: "One Piece 🏴‍☠️", cat: "Anime" },
  { label: "Attack on Titan ⚔️", cat: "Anime" },
  { label: "Demon Slayer 🗡️", cat: "Anime" },
  { label: "Drake 🎤", cat: "Musique" },
  { label: "Booba 👑", cat: "Musique" },
  { label: "Taylor Swift 🎸", cat: "Musique" },
  { label: "Jul 🌴", cat: "Musique" },
  { label: "PNL 🌙", cat: "Musique" },
  { label: "Ninho 🐦", cat: "Musique" },
  { label: "Freeze Corleone 🖤", cat: "Musique" },
  { label: "Se réveiller à 5h du matin ⏰", cat: "Activité" },
  { label: "Vivre sans Internet 📵", cat: "Activité" },
  { label: "Manger que de la salade 1 mois 🥗", cat: "Activité" },
  { label: "Avoir des pouvoirs de télékinésie 🧠", cat: "Superpouvoirs" },
  { label: "Voler comme Superman 🦸", cat: "Superpouvoirs" },
  { label: "Être invisible 👻", cat: "Superpouvoirs" },
  { label: "Voyager dans le temps ⏳", cat: "Superpouvoirs" },
  { label: "Game of Thrones 🐉", cat: "Séries" },
  { label: "Breaking Bad 🧪", cat: "Séries" },
  { label: "Avengers 🦸", cat: "Films" },
  { label: "Titanic 🚢", cat: "Films" },
];

const DURATION_SEC = 30;

function buildResultBar(smash, pass) {
  const total = smash + pass;
  if (total === 0) return "**Aucun vote !**";
  const smashPct = Math.round((smash / total) * 100);
  const passPct  = 100 - smashPct;
  const barLen   = 20;
  const smashBar = "🟩".repeat(Math.round((smashPct / 100) * barLen));
  const passBar  = "🟥".repeat(Math.round((passPct / 100) * barLen));
  const winner   = smash > pass ? "💪 **SMASH** l'emporte !" : pass > smash ? "❌ **PASS** l'emporte !" : "🤝 **Égalité !**";
  return `${winner}\n\n${smashBar}${passBar}\n💪 ${smashPct}%  •  ${passPct}% ❌`;
}

export async function executeSmashPass(message, args, PREFIX) {
  const customTopic = args.join(" ").trim();
  let topic, cat;
  if (customTopic) {
    topic = customTopic;
    cat = "Personnalisé";
  } else {
    const picked = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    topic = picked.label;
    cat = picked.cat;
  }

  const smashVoters = new Set();
  const passVoters  = new Set();

  const buildEmbed = (ended = false) => ({
    color: ended ? 0x2f3136 : 0x5865f2,
    title: ended ? `📊 Résultats — ${topic}` : `💥 Smash or Pass — ${topic}`,
    description: ended
      ? buildResultBar(smashVoters.size, passVoters.size)
      : `📂 **Catégorie :** ${cat}\n⏱️ **${DURATION_SEC} secondes** pour voter !\n_Un seul vote par personne — tu peux changer d'avis._`,
    fields: [
      { name: "💪 Smash", value: `**${smashVoters.size}** vote(s)`, inline: true },
      { name: "❌ Pass",  value: `**${passVoters.size}** vote(s)`,  inline: true },
    ],
    footer: { text: ended ? `Total : ${smashVoters.size + passVoters.size} votant(s) • CASTEL PROTECT` : `Lancé par ${message.author.tag} • CASTEL PROTECT` },
    timestamp: new Date().toISOString(),
  });

  const buildRow = (disabled = false) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("smash").setLabel(`💪 Smash   ${smashVoters.size}`).setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId("pass").setLabel(`❌ Pass   ${passVoters.size}`).setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );

  const msg = await message.channel.send({ embeds: [buildEmbed()], components: [buildRow()] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: DURATION_SEC * 1000 });

  collector.on("collect", async (interaction) => {
    const uid = interaction.user.id;
    if (interaction.customId === "smash") {
      if (smashVoters.has(uid)) return interaction.reply({ content: "✋ Tu as déjà voté **Smash** ! Clique **Pass** pour changer.", ephemeral: true });
      passVoters.delete(uid);
      smashVoters.add(uid);
    } else {
      if (passVoters.has(uid)) return interaction.reply({ content: "✋ Tu as déjà voté **Pass** ! Clique **Smash** pour changer.", ephemeral: true });
      smashVoters.delete(uid);
      passVoters.add(uid);
    }
    await interaction.update({ embeds: [buildEmbed()], components: [buildRow()] });
  });

  collector.on("end", async () => {
    await msg.edit({ embeds: [buildEmbed(true)], components: [buildRow(true)] }).catch(() => {});
  });
}

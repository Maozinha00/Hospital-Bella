import "dotenv/config";
import express from "express";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Faltando TOKEN / CLIENT_ID / GUILD_ID");
  process.exit(1);
}

// 🧭 CONFIG
const CATEGORY_ID = "1492387782394515466";
const LOG_CHANNEL_ID = "1477683906642706506";

// 🛡️ STAFF
const STAFF_ID = "1490431614055088128";

// 🎭 CARGOS
const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const CARGO_ADV = "1477683902041690350";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder().setName("painelhp").setDescription("Criar painel hospital"),
  new SlashCommandBuilder().setName("rankinghp").setDescription("Ver ranking")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 30000);
});

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 👑 HIERARQUIA
async function getBoss(guild) {
  const roles = [
    "1477683902121509018",
    "1477683902121509017",
    "1477683902121509016",
    "1477683902121509015"
  ];

  for (const id of roles) {
    const role = guild.roles.cache.get(id);
    if (role && role.members.size > 0) {
      const user = role.members.first();
      return `<@${user.id}>`;
    }
  }
  return "Nenhum";
}

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;
      list += `┆ 👨‍⚕️ <@${id}> • ${format(time)}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(
`🏥 ═══════〔 HOSPITAL BELLA 〕═══════

👑 RESPONSÁVEL DO PLANTÃO
${await getBoss(channel.guild)}

👨‍⚕️ MÉDICOS EM SERVIÇO
${list || "┆ Nenhum"}

📊 STATUS
┆ Ativos: ${pontos.size}
┆ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

💎 Sistema Premium`
      );

    await msg.edit({ embeds: [embed] });

  } catch (err) {
    console.log(err.message);
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!member.roles.cache.has(STAFF_ID)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    // PAINEL
    if (interaction.commandName === "painelhp") {

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("iniciar")
          .setLabel("🟢 Iniciar")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("finalizar")
          .setLabel("🔴 Finalizar")
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#0f172a")
            .setDescription("🏥 Painel Hospital ativo")
        ],
        components: [row]
      });

      config.painel = interaction.channel.id;
      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    // RANKING
    if (interaction.commandName === "rankinghp") {

      const top = [...ranking.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, t]) => `<@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Ranking")
            .setDescription(top || "Sem dados")
        ]
      });
    }
  }

  // BOTÕES
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const time = Date.now() - p.inicio;

      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      return interaction.reply({
        content: `🔴 Finalizado: ${format(time)}`,
        ephemeral: true
      });
    }
  }
});

// 🛡️ ANTI CRASH
process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

// 🚀 LOGIN
client.login(TOKEN);

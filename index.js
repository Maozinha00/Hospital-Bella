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

// 🔐 TOKEN
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Faltando TOKEN / CLIENT_ID / GUILD_ID");
  process.exit(1);
}

// 🛡️ STAFF
const STAFF_ID = "1490431614055088128";

// 🎭 CARGOS
const CARGO_ADV = "1477683902041690350";

// 🧠 SISTEMA
let config = { painel: null, msgId: null, logs: null };
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
  new SlashCommandBuilder().setName("rankinghp").setDescription("Ver ranking de plantão")
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

// 👑 RESPONSÁVEL DO PLANTÃO (HIERARQUIA)
function getBoss(guild) {
  const roles = [
    "1477683902121509018", // Diretor
    "1477683902121509017", // Vice
    "1477683902121509016", // Supervisor
    "1477683902121509015"  // Coordenador
  ];

  for (const id of roles) {
    const role = guild.roles.cache.get(id);
    if (role && role.members.size > 0) {
      const user = role.members.first();
      return `<@${user.id}> • ${role.name}`;
    }
  }

  return "Nenhum responsável ativo";
}

// 🏥 PAINEL PREMIUM
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let lista = "";

    for (const [id, data] of pontos) {
      const tempo = Date.now() - data.inicio;
      lista += `┆ 👨‍⚕️ <@${id}> • ${format(tempo)}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(
`🏥 ═══════〔 HOSPITAL BELLA PREMIUM 〕═══════

👑 RESPONSÁVEL DO PLANTÃO
${getBoss(channel.guild)}

👨‍⚕️ MÉDICOS EM SERVIÇO
${lista || "┆ Nenhum médico em serviço"}

📊 STATUS DO SISTEMA
┆ 👥 Ativos: ${pontos.size}
┆ 🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

💎 Sistema Hospitalar Premium`
      );

    await msg.edit({ embeds: [embed] });

  } catch (err) {
    console.log("Painel error:", err.message);
  }
}

// 🔒 PROTEÇÃO STAFF
async function isStaff(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return member.roles.cache.has(STAFF_ID);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!(await isStaff(interaction))) {
      return interaction.reply({ content: "❌ Sem permissão (STAFF)", ephemeral: true });
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
            .setDescription("🏥 Painel Hospital Premium ativo")
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
            .setTitle("🏆 Ranking Hospitalar")
            .setDescription(top || "Sem dados")
            .setColor("#0f172a")
        ]
      });
    }
  }

  // BOTÕES
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });

      return interaction.reply({
        content: "🟢 Plantão iniciado!",
        ephemeral: true
      });
    }

    if (interaction.customId === "finalizar") {

      const p = pontos.get(id);
      if (!p) {
        return interaction.reply({ content: "❌ Você não iniciou", ephemeral: true });
      }

      const tempo = Date.now() - p.inicio;
      ranking.set(id, (ranking.get(id) || 0) + tempo);
      pontos.delete(id);

      return interaction.reply({
        content: `🔴 Finalizado: ${format(tempo)}`,
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

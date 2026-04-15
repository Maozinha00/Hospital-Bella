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

import express from "express";

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Faltando TOKEN, CLIENT_ID ou GUILD_ID");
  process.exit(1);
}

// 🎭 CARGOS
const STAFF_ID = "1490431614055088128";

// 🧠 SISTEMA
const pontos = new Map();
const ranking = new Map();
let config = { painel: null, msgId: null, logs: null };

// 🤖 CLIENT (IMPORTANTE: Members INTENT)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true))
    .addChannelOption(o =>
      o.setName("logs").setDescription("Logs").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Reset sistema")
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online como ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(atualizarPainel, 30000);
});

// ⏱ FORMATAR
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 👑 RESPONSÁVEL POR HIERARQUIA
async function getResponsavel(guild) {
  const cargos = [
    "1477683902121509018", // Diretor
    "1477683902121509017", // Vice
    "1477683902121509016", // Supervisor
    "1477683902121509015"  // Coordenador
  ];

  for (const id of cargos) {
    const role = guild.roles.cache.get(id);
    if (role && role.members.size > 0) {
      const user = role.members.first();
      return `<@${user.id}> • ${role.name}`;
    }
  }

  return "Nenhum";
}

// 🏥 PAINEL
async function atualizarPainel() {
  try {
    if (!config.painel || !config.msgId) return;

    const canal = await client.channels.fetch(config.painel);
    if (!canal) return;

    const msg = await canal.messages.fetch(config.msgId);
    if (!msg) return;

    let lista = "";
    let chefe = null;
    let maior = 0;

    for (const [id, data] of pontos) {
      const tempo = Date.now() - data.inicio;

      if (tempo > maior) {
        maior = tempo;
        chefe = id;
      }

      lista += `👨‍⚕️ <@${id}> • ${formatar(tempo)}\n`;
    }

    const responsavel = await getResponsavel(canal.guild);

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(
`🏥 **HOSPITAL BELLA**

👑 RESPONSÁVEL DO PLANTÃO
${responsavel}

👑 MÉDICO MAIS ATIVO
${chefe ? `<@${chefe}> • ${formatar(maior)}` : "Nenhum"}

👨‍⚕️ EM SERVIÇO
${lista || "Nenhum"}

📊 ATIVOS: ${pontos.size}
🕒 ${new Date().toLocaleString()}

Sistema automático`
      );

    await msg.edit({ embeds: [embed] });
  } catch (err) {
    console.log("Erro painel:", err.message);
  }
}

// 🔐 PROTEÇÃO STAFF
async function isStaff(member) {
  return member.roles.cache.has(STAFF_ID);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.guild) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // 🔒 PROTEÇÃO GLOBAL
    const allowed = ["painelhp", "rankinghp"];

    if (interaction.isChatInputCommand()) {

      if (!allowed.includes(interaction.commandName)) {
        if (!member.roles.cache.has(STAFF_ID)) {
          return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
        }
      }

      // PAINEL
      if (interaction.commandName === "painelhp") {
        const canal = interaction.options.getChannel("canal");
        const logs = interaction.options.getChannel("logs");

        if (!canal || !logs) {
          return interaction.reply({ content: "❌ Canal inválido", ephemeral: true });
        }

        config.painel = canal.id;
        config.logs = logs.id;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setTitle("🏥 Painel Hospital")
          .setDescription("Sistema ativo");

        const msg = await canal.send({ embeds: [embed], components: [row] });

        config.msgId = msg.id;

        return interaction.reply({ content: "✅ Criado!", ephemeral: true });
      }

      // RANKING
      if (interaction.commandName === "rankinghp") {
        const lista = [...ranking.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, t]) => `<@${id}> • ${formatar(t)}`)
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 Ranking")
              .setDescription(lista || "Sem dados")
          ]
        });
      }
    }

    // 🔘 BOTÕES
    if (interaction.isButton()) {
      const id = interaction.user.id;

      if (interaction.customId === "iniciar") {
        pontos.set(id, { inicio: Date.now() });
        return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
      }

      if (interaction.customId === "finalizar") {
        const p = pontos.get(id);
        if (!p) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

        const tempo = Date.now() - p.inicio;
        ranking.set(id, (ranking.get(id) || 0) + tempo);
        pontos.delete(id);

        return interaction.reply({
          content: `🔴 Finalizado: ${formatar(tempo)}`,
          ephemeral: true
        });
      }
    }
  } catch (err) {
    console.log("Interaction error:", err.message);
  }
});

// 🚀 LOGIN
client.login(TOKEN);

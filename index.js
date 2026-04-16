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

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1490431614055088128";

// 🧠 SISTEMA
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🔐 STAFF CHECK
function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE);
}

// 📌 COMMANDS
const commands = [

new SlashCommandBuilder()
  .setName("painelhp")
  .setDescription("Criar painel hospital")
  .addChannelOption(o =>
    o.setName("canal").setDescription("Canal do painel").setRequired(true))
  .addChannelOption(o =>
    o.setName("logs").setDescription("Canal de logs").setRequired(true)),

new SlashCommandBuilder()
  .setName("addhora")
  .setDescription("Adicionar tempo a um usuário")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))
  .addIntegerOption(o =>
    o.setName("horas").setDescription("Horas").setRequired(false))
  .addIntegerOption(o =>
    o.setName("minutos").setDescription("Minutos").setRequired(false)),

new SlashCommandBuilder()
  .setName("removerhora")
  .setDescription("Remover tempo de um usuário")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))
  .addIntegerOption(o =>
    o.setName("horas").setDescription("Horas").setRequired(false))
  .addIntegerOption(o =>
    o.setName("minutos").setDescription("Minutos").setRequired(false)),

new SlashCommandBuilder()
  .setName("resethp")
  .setDescription("Resetar sistema"),

new SlashCommandBuilder()
  .setName("rankinghp")
  .setDescription("Ver ranking de horas"),

new SlashCommandBuilder()
  .setName("forcar_entrar")
  .setDescription("STAFF: colocar usuário em serviço")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true)),

new SlashCommandBuilder()
  .setName("forcar_sair")
  .setDescription("STAFF: retirar usuário do serviço")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))

].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Bot online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
});

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;
      list += `👨‍⚕️ <@${id}> • ${format(time)}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(
`🏥 HOSPITAL BELLA

👨‍⚕️ EM SERVIÇO
${list || "Nenhum médico ativo"}

👥 Total: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>`
      );

    await msg.edit({ embeds: [embed] });

  } catch (e) {}
}

// 🎯 COMMANDS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!isStaff(member)) {
    return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
  }

  const user = interaction.options.getUser("usuario");

  // PAINEL
  if (interaction.commandName === "painelhp") {
    const canal = interaction.options.getChannel("canal");
    const logs = interaction.options.getChannel("logs");

    config.painel = canal.id;
    config.logs = logs.id;

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

    const msg = await canal.send({
      embeds: [new EmbedBuilder().setDescription("🏥 Painel Hospital ativo")],
      components: [row]
    });

    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
  }

  // ➕ ADD TEMPO
  if (interaction.commandName === "addhora") {
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;

    const tempo = (h * 3600000) + (m * 60000);

    ranking.set(user.id, (ranking.get(user.id) || 0) + tempo);

    return interaction.reply({
      content: `✅ Adicionado: ${h}h ${m}m`,
      ephemeral: true
    });
  }

  // ➖ REMOVE TEMPO
  if (interaction.commandName === "removerhora") {
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;

    const tempo = (h * 3600000) + (m * 60000);

    ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - tempo));

    return interaction.reply({
      content: `❌ Removido: ${h}h ${m}m`,
      ephemeral: true
    });
  }

  // RESET
  if (interaction.commandName === "resethp") {
    pontos.clear();
    ranking.clear();
    return interaction.reply({ content: "♻️ Sistema resetado!", ephemeral: true });
  }

  // RANKING
  if (interaction.commandName === "rankinghp") {
    const top = [...ranking.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, t]) => `<@${id}> • ${format(t)}`)
      .join("\n");

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(top || "Sem dados")]
    });
  }

  // 🟢 FORÇAR ENTRAR
  if (interaction.commandName === "forcar_entrar") {
    if (pontos.has(user.id)) {
      return interaction.reply({ content: "❌ Já está em serviço", ephemeral: true });
    }

    pontos.set(user.id, { inicio: Date.now() });

    return interaction.reply({
      content: `🟢 ${user} colocado em serviço`,
      ephemeral: true
    });
  }

  // 🔴 FORÇAR SAIR
  if (interaction.commandName === "forcar_sair") {
    const p = pontos.get(user.id);

    if (!p) {
      return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });
    }

    const time = Date.now() - p.inicio;

    ranking.set(user.id, (ranking.get(user.id) || 0) + time);
    pontos.delete(user.id);

    return interaction.reply({
      content: `🔴 ${user} saiu • ${format(time)}`,
      ephemeral: true
    });
  }
});

// 🔘 BOTÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const id = interaction.user.id;

  if (interaction.customId === "iniciar") {
    pontos.set(id, { inicio: Date.now() });
    return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
  }

  if (interaction.customId === "finalizar") {
    const p = pontos.get(id);

    if (!p) {
      return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });
    }

    const time = Date.now() - p.inicio;

    ranking.set(id, (ranking.get(id) || 0) + time);
    pontos.delete(id);

    return interaction.reply({
      content: `🔴 Finalizado: ${format(time)}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);

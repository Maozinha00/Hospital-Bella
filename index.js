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
app.get("/", (_, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 CONFIG
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

// 🔁 HORAS + MINUTOS -> MS
function toMs(h = 0, m = 0) {
  return (h * 3600000) + (m * 60000);
}

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

// 👑 RESPONSÁVEIS
function getBossList(guild) {
  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    const member = role?.members?.first();

    return member
      ? `👑 <@${member.id}> • ${r.nome}`
      : `👑 Nenhum • ${r.nome}`;
  }).join("\n");
}

// 🔐 STAFF CHECK
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
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
  .setDescription("Adicionar tempo (horas e minutos)")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))
  .addIntegerOption(o =>
    o.setName("horas").setDescription("Horas").setRequired(false))
  .addIntegerOption(o =>
    o.setName("minutos").setDescription("Minutos").setRequired(false)),

new SlashCommandBuilder()
  .setName("removerhora")
  .setDescription("Remover tempo (horas e minutos)")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))
  .addIntegerOption(o =>
    o.setName("horas").setDescription("Horas").setRequired(false))
  .addIntegerOption(o =>
    o.setName("minutos").setDescription("Minutos").setRequired(false)),

new SlashCommandBuilder()
  .setName("resethp")
  .setDescription("Reset sistema"),

new SlashCommandBuilder()
  .setName("rankinghp")
  .setDescription("Ver ranking"),

new SlashCommandBuilder()
  .setName("forcar_entrar")
  .setDescription("Colocar usuário em serviço")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true)),

new SlashCommandBuilder()
  .setName("forcar_sair")
  .setDescription("Tirar usuário do serviço e salvar tempo")
  .addUserOption(o =>
    o.setName("usuario").setDescription("Usuário").setRequired(true))

].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

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
      list += `👨‍⚕️ <@${id}> • ${format(Date.now() - data.inicio)}\n`;
    }

    if (!list) list = "- Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 **HOSPITAL BELLA**

👑 Responsáveis:
${getBossList(channel.guild)}

──────────────────

👨‍⚕️ Em serviço:
${list}

──────────────────

👥 Ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>
`);

    await msg.edit({ embeds: [embed] });

  } catch {}
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;
  if (!isStaff(member))
    return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });

  const user = interaction.options.getUser("usuario");

  // PAINEL
  if (interaction.commandName === "painelhp") {
    const canal = interaction.options.getChannel("canal");
    const logs = interaction.options.getChannel("logs");

    config.painel = canal.id;
    config.logs = logs.id;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
    );

    const msg = await canal.send({
      embeds: [new EmbedBuilder().setTitle("🏥 PAINEL HOSPITAL").setColor("#0f172a")],
      components: [row]
    });

    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
  }

  // ADD TEMPO
  if (interaction.commandName === "addhora") {
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;

    ranking.set(user.id, (ranking.get(user.id) || 0) + toMs(h, m));

    return interaction.reply({ content: "✅ Tempo adicionado!", ephemeral: true });
  }

  // REMOVE TEMPO
  if (interaction.commandName === "removerhora") {
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;

    ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - toMs(h, m)));

    return interaction.reply({ content: "❌ Tempo removido!", ephemeral: true });
  }

  // FORÇAR ENTRAR
  if (interaction.commandName === "forcar_entrar") {
    pontos.set(user.id, { inicio: Date.now() });
    return interaction.reply({ content: `🟢 ${user} em serviço`, ephemeral: true });
  }

  // FORÇAR SAIR
  if (interaction.commandName === "forcar_sair") {
    const p = pontos.get(user.id);

    if (!p)
      return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });

    ranking.set(user.id, (ranking.get(user.id) || 0) + (Date.now() - p.inicio));
    pontos.delete(user.id);

    return interaction.reply({
      content: `🔴 ${user} removido do serviço`,
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
    if (!p) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

    ranking.set(id, (ranking.get(id) || 0) + (Date.now() - p.inicio));
    pontos.delete(id);

    return interaction.reply({
      content: `🔴 Finalizado: ${format(Date.now() - p.inicio)}`
    });
  }
});

client.login(TOKEN);

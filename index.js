require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const express = require("express");

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

// 🛡️ CARGOS
const STAFF = "1490431614055088128";
const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const CARGO_ADV = "1477683902041690350";

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

const TEMPO_MAXIMO = 7 * 60 * 60 * 1000;

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS COMPLETOS
const commands = [

  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital"),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Resetar sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(false)),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(false))

].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

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

// 👑 HIERARQUIA RESPONSÁVEL
function getResponsavel(guild) {
  for (const c of HIERARQUIA) {
    const role = guild.roles.cache.get(c.id);
    if (role && role.members.size > 0) {
      const m = role.members.first();
      return `<@${m.id}> • ${c.nome}`;
    }
  }
  return "Nenhum";
}

// 🏥 PAINEL BONITO
async function atualizarPainel() {
  if (!config.painel || !config.msgId) return;

  const canal = await client.channels.fetch(config.painel).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";
  let maior = 0;

  for (const [id, d] of pontos) {
    const t = Date.now() - d.inicio;
    if (t > maior) maior = t;
    lista += `┆ 👨‍⚕️ <@${id}> • ${formatar(t)}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(
`🏥 ═══════〔 HOSPITAL BELLA 〕═══════

👑 RESPONSÁVEL DO PLANTÃO
${getResponsavel(canal.guild)}

👨‍⚕️ MÉDICOS EM SERVIÇO
${lista || "- Nenhum"}

📊 STATUS
┆ Ativos: ${pontos.size}
┆ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

🔥 Sistema Hospitalar Premium`
    );

  msg.edit({ embeds: [embed] });
}

// 🎯 PROTEÇÃO STAFF
async function isStaff(interaction) {
  const m = await interaction.guild.members.fetch(interaction.user.id);
  return m.roles.cache.has(STAFF);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  if (!(await isStaff(interaction))) {
    return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
  }

  // 🏥 PAINEL
  if (interaction.commandName === "painelhp") {
    const canal = interaction.channel;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
    );

    const msg = await canal.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#0f172a")
          .setDescription("🏥 Painel Hospital ativo")
      ],
      components: [row]
    });

    config.painel = canal.id;
    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
  }

  // 🏆 RANKING
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

  // 🔄 RESET
  if (interaction.commandName === "resetponto") {
    pontos.clear();
    ranking.clear();
    return interaction.reply("✅ Resetado!");
  }

  // ➕ ADD HORA
  if (interaction.commandName === "addhora") {
    const u = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas");
    const m = interaction.options.getInteger("minutos") || 0;

    const ms = (h * 60 + m) * 60000;
    ranking.set(u.id, (ranking.get(u.id) || 0) + ms);

    return interaction.reply({ content: `✅ ${u} atualizado`, ephemeral: true });
  }

  // ➖ REMOVER HORA
  if (interaction.commandName === "removerhora") {
    const u = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas");
    const m = interaction.options.getInteger("minutos") || 0;

    const ms = (h * 60 + m) * 60000;
    ranking.set(u.id, Math.max(0, (ranking.get(u.id) || 0) - ms));

    return interaction.reply({ content: `❌ ${u} atualizado`, ephemeral: true });
  }
});

// 🔘 BOTÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  const id = interaction.user.id;
  const member = interaction.member;

  if (interaction.customId === "iniciar") {
    pontos.set(id, { inicio: Date.now() });

    await member.roles.add(CARGO_EM).catch(() => {});
    await member.roles.remove(CARGO_FORA).catch(() => {});

    return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
  }

  if (interaction.customId === "finalizar") {
    const p = pontos.get(id);
    if (!p) return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

    const tempo = Date.now() - p.inicio;

    ranking.set(id, (ranking.get(id) || 0) + tempo);
    pontos.delete(id);

    await member.roles.remove(CARGO_EM).catch(() => {});
    await member.roles.add(CARGO_FORA).catch(() => {});

    return interaction.reply({
      content: `🔴 Finalizado: ${formatar(tempo)}`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);

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

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// 📢 LOG RESET
const CANAL_LOG_RESET = "1495178025602515177";

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Configure TOKEN, CLIENT_ID e GUILD_ID");
  process.exit(1);
}

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";
const ROLE_EM_SERVICO = "1492553421973356795";
const ROLE_FORA_SERVICO = "1492553631642288160";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
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

function tempoRelativo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "há poucos segundos";
  if (m === 1) return "há um minuto";
  return `há ${m} minutos`;
}

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role) return `👑 Nenhum • ${r.nome}`;

    const member = role.members.filter(m => !usados.has(m.id)).first();
    if (!member) return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("🟢 Iniciar")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("finalizar")
      .setLabel("🔴 Finalizar")
      .setStyle(ButtonStyle.Danger)
  );
}

// ⚠️ RESET BOTÕES
function resetRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_reset")
      .setLabel("⚠️ CONFIRMAR RESET")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("cancel_reset")
      .setLabel("❌ CANCELAR")
      .setStyle(ButtonStyle.Secondary)
  );
}

// 📌 COMMANDS (🔥 CORRIGIDO COM DESCRIPTION EM TUDO)
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar tempo")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(false))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(false)),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover tempo")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(false))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(false)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking do hospital"),

  new SlashCommandBuilder()
    .setName("forcar_entrar")
    .setDescription("Colocar em serviço")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("forcar_sair")
    .setDescription("Retirar do serviço")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("resetgeral")
    .setDescription("🚨 Reset total do sistema hospital")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

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
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

👑 RESPONSÁVEL
${getBossList(channel.guild)}

────────────────────────────

👨‍⚕️ EM SERVIÇO
${list}

────────────────────────────
👥 Ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (err) {
    console.log("Erro painel:", err.message);
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    // 🚨 RESET
    if (interaction.commandName === "resetgeral") {
      return interaction.reply({
        content: "⚠️ Tem certeza que deseja RESETAR TODO O SISTEMA?",
        components: [resetRow()],
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;
    const tempo = (h * 3600000) + (m * 60000);

    if (interaction.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a,b) => b[1]-a[1])
        .map(([id,t]) => `<@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(top || "Sem dados")]
      });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "cancel_reset") {
      return interaction.update({
        content: "❌ Reset cancelado com segurança.",
        components: []
      });
    }

    if (interaction.customId === "confirm_reset") {

      if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
        return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
      }

      pontos.clear();
      ranking.clear();
      config = { painel: null, msgId: null };

      const log = interaction.guild.channels.cache.get(CANAL_LOG_RESET);

      if (log) {
        log.send({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("🚨 RESET GERAL EXECUTADO")
              .setDescription(`
🧠 Ranking zerado
🏥 Plantões encerrados
⚙️ Sistema reiniciado

👤 Por: <@${id}>
🕒 <t:${Math.floor(Date.now() / 1000)}:F>
              `)
          ]
        });
      }

      return interaction.update({
        content: "🚨 RESET GERAL EXECUTADO COM SUCESSO!",
        components: []
      });
    }

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

      return interaction.reply({ content: `🔴 Finalizado • ${format(time)}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);

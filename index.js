import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

import express from "express";

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 TOKEN
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.log("❌ TOKEN não encontrado");
  process.exit(1);
}

// 🏥 CONFIG
const TEMPO_MAXIMO = 7 * 60 * 60 * 1000;

// 🎭 CARGOS
const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const CARGO_ADV = "1477683902041690350";

// 👑 HIERARQUIA (RESPONSÁVEL DO PLANTÃO)
const HIERARQUIA = [
  "1477683902121509018", // Diretor
  "1477683902121509017", // Vice
  "1477683902121509016", // Supervisor
  "1477683902121509015"  // Coordenador
];

// 🔐 STAFF
const STAFF_ID = "1490431614055088128";
const GUILD_ID = "1477683902041690342";

// 🧠 SISTEMA
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🤖 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true))
    .addChannelOption(o =>
      o.setName("logs").setDescription("Canal de logs").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Reset sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos")),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos"))
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  setInterval(atualizarPainel, 30000);
  setInterval(verificarTempo, 60000);
});

// ⏱️ FORMATAR
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 👑 HIERARQUIA RESPONSÁVEL
async function getResponsavel(guild) {
  for (const roleId of HIERARQUIA) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;

    const membros = role.members;
    if (membros.size > 0) {
      const membro = membros.first();
      return `<@${membro.id}> • ${role.name}`;
    }
  }
  return "Nenhum";
}

// 🏥 PAINEL
async function atualizarPainel() {
  if (!config.painel || !config.msgId) return;

  const canal = await client.channels.fetch(config.painel).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";
  let chefe = null;
  let maiorTempo = 0;

  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;

    if (tempo > maiorTempo) {
      maiorTempo = tempo;
      chefe = id;
    }

    lista += `┆ 👨‍⚕️ <@${id}> • ${formatar(tempo)}\n`;
  }

  const responsavel = await getResponsavel(canal.guild);

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(
`🏥 ═══════〔 HOSPITAL BELLA 〕═══════

👑 RESPONSÁVEL DO PLANTÃO
${responsavel}

👑 MÉDICO MAIS ATIVO
${chefe ? `<@${chefe}> • ${formatar(maiorTempo)}` : "Nenhum"}

👨‍⚕️ MÉDICOS EM SERVIÇO
${lista || "- Nenhum em serviço"}

📊 STATUS
👥 Ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

🏥 Sistema Hospitalar Premium`
    )
    .setTimestamp();

  msg.edit({ embeds: [embed] }).catch(() => {});
}

// 🚨 TEMPO LIMITE
async function verificarTempo() {
  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;

    if (tempo >= TEMPO_MAXIMO) {
      const guild = client.guilds.cache.first();
      const membro = await guild.members.fetch(id).catch(() => null);
      if (!membro) continue;

      await membro.roles.add(CARGO_ADV).catch(() => {});
      pontos.delete(id);

      atualizarPainel();
    }
  }
}

// 🔐 PROTEÇÃO STAFF
async function isStaff(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return member.roles.cache.has(STAFF_ID);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

  // COMMANDS
  if (interaction.isChatInputCommand()) {

    if (!["painelhp", "rankinghp"].includes(interaction.commandName)) {
      if (!(await isStaff(interaction))) {
        return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
      }
    }

    // PAINEL
    if (interaction.commandName === "painelhp") {
      config.painel = interaction.options.getChannel("canal").id;
      config.logs = interaction.options.getChannel("logs").id;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle("🏥 Controle de Plantão")
        .setDescription("Sistema ativo — use os botões abaixo");

      const canal = await client.channels.fetch(config.painel);
      const msg = await canal.send({ embeds: [embed], components: [row] });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
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

    // RESET
    if (interaction.commandName === "resetponto") {
      pontos.clear();
      ranking.clear();
      return interaction.reply("✅ Resetado!");
    }

    // ADD
    if (interaction.commandName === "addhora") {
      const user = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const ms = (h * 60 + m) * 60000;
      ranking.set(user.id, (ranking.get(user.id) || 0) + ms);

      return interaction.reply({ content: "✅ Adicionado", ephemeral: true });
    }

    // REMOVE
    if (interaction.commandName === "removerhora") {
      const user = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const ms = (h * 60 + m) * 60000;
      ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - ms));

      return interaction.reply({ content: "❌ Removido", ephemeral: true });
    }
  }

  // BUTTONS
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
});

// 🚀 LOGIN
client.login(TOKEN);

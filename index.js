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

// 🔐 CONFIG ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Faltando TOKEN / CLIENT_ID / GUILD_ID");
  process.exit(1);
}

// 🛡️ STAFF
const STAFF_ROLE = "1490431614055088128";

// 👑 CARGOS
const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

// 🧠 SISTEMA
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
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
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true)),

  new SlashCommandBuilder()
    .setName("resethp")
    .setDescription("Resetar sistema"),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking")
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

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 👑 HIERARQUIA
function getBoss(guild) {
  for (const roleData of HIERARQUIA) {
    const role = guild.roles.cache.get(roleData.id);
    if (role && role.members.size > 0) {
      const user = role.members.first();
      return `<@${user.id}> • ${roleData.nome}`;
    }
  }
  return "Nenhum";
}

// 🏥 PAINEL BONITO
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
`🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

✨ SISTEMA DE PLANTÃO EM FUNCIONAMENTO

👑 RESPONSÁVEL DO PLANTÃO
${getBoss(channel.guild)}

────────────────────────────

👨‍⚕️ EQUIPE EM SERVIÇO
${list || "- Nenhum médico em serviço no momento"}

────────────────────────────

📊 STATUS DO SISTEMA
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

────────────────────────────

🚨 OBSERVAÇÕES
• Sistema automático de controle de plantão
• Registro de horas em tempo real
• Ranking atualizado continuamente

🏥 Hospital Bella • Sistema Profissional`
      );

    await msg.edit({ embeds: [embed] });

  } catch {}
}

// 🔐 PROTEÇÃO STAFF
function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE);
}

// 🎯 COMMANDS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!isStaff(member)) {
    return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
  }

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
      embeds: [
        new EmbedBuilder()
          .setColor("#0f172a")
          .setDescription("🏥 Painel Hospital ativo")
      ],
      components: [row]
    });

    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
  }

  // ADD HORA
  if (interaction.commandName === "addhora") {
    const user = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas") * 3600000;

    ranking.set(user.id, (ranking.get(user.id) || 0) + h);

    return interaction.reply({ content: "✅ Hora adicionada!", ephemeral: true });
  }

  // REMOVE HORA
  if (interaction.commandName === "removerhora") {
    const user = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas") * 3600000;

    ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - h));

    return interaction.reply({ content: "❌ Hora removida!", ephemeral: true });
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
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Ranking")
          .setDescription(top || "Sem dados")
      ]
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

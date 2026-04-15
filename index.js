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

// 🔐 CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Faltando TOKEN / CLIENT_ID / GUILD_ID");
  process.exit(1);
}

if (!CATEGORY_ID || !LOG_CHANNEL_ID) {
  console.warn("⚠️  CATEGORY_ID ou LOG_CHANNEL_ID não definidos — algumas funções podem não operar corretamente.");
}


// 🛡️ CARGOS
const STAFF = "1490431614055088128";
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
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder().setName("painelhp").setDescription("Criar painel"),
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

// ⏱ FORMATAR
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 👑 HIERARQUIA RESPONSÁVEL
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

// 🏥 PAINEL
async function updatePanel() {
  if (!config.painel || !config.msgId) return;

  const channel = await client.channels.fetch(config.painel).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

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
${getBoss(channel.guild)}

👨‍⚕️ MÉDICOS EM SERVIÇO
${list || "- Nenhum"}

📊 STATUS
┆ Ativos: ${pontos.size}
┆ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

🔥 Sistema Premium`
    );

  msg.edit({ embeds: [embed] });
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!member.roles.cache.has(STAFF)) {
    return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
  }

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
          .setDescription("🏥 Painel Hospital ativo")
          .setColor("#0f172a")
      ],
      components: [row]
    });

    config.painel = interaction.channel.id;
    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
  }

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
  const member = interaction.member;

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

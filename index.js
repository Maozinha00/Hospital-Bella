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

// 📌 COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal")
        .setDescription("Canal")
        .setRequired(true)
    )
].map(c => c.toJSON());

// 🔥 CONTROLE ANTI RATE LIMIT
let updating = false;

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  // ⏱ 3 SEGUNDOS
  setInterval(updatePanel, 3000);
});

// 🏥 UPDATE PANEL
async function updatePanel() {
  if (updating) return;
  updating = true;

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

** ✨ SISTEMA DE PLANTÃO EM FUNCIONAMENTO **

** 👑 RESPONSÁVEL DO PLANTÃO **
${getBossList(channel.guild)}

────────────────────────────

** 👨‍⚕️ EQUIPE EM SERVIÇO **
${list}

────────────────────────────

📊 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

────────────────────────────

🏥 Hospital Bella • Sistema Profissional
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (err) {
    console.log("Erro painel:", err.message);
  }

  updating = false;
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Sem permissão", flags: 64 });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [
          new EmbedBuilder()
            .setDescription("🏥 Painel ativo")
            .setColor("#0f172a")
        ],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({
        content: "✅ Painel criado!",
        flags: 64
      });
    }
  }

  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      if (pontos.has(id)) return interaction.reply({ content: "❌ Já em serviço", flags: 64 });

      pontos.set(id, { inicio: Date.now() });

      const m = interaction.guild.members.cache.get(id);
      if (m) {
        await m.roles.add(ROLE_EM_SERVICO).catch(() => {});
        await m.roles.remove(ROLE_FORA_SERVICO).catch(() => {});
      }

      return interaction.reply({ content: "🟢 Iniciado!", flags: 64 });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return interaction.reply({ content: "❌ Não iniciou", flags: 64 });

      const time = Date.now() - p.inicio;
      pontos.delete(id);

      const m = interaction.guild.members.cache.get(id);
      if (m) {
        await m.roles.remove(ROLE_EM_SERVICO).catch(() => {});
        await m.roles.add(ROLE_FORA_SERVICO).catch(() => {});
      }

      return interaction.reply({
        content: `🔴 Finalizado • ${format(time)}`,
        flags: 64
      });
    }
  }
});

client.login(TOKEN);

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

/* =========================
   🌐 KEEP ALIVE
========================= */
const app = express();
app.get("/", (_, res) => res.send("Bot online 🔥"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Web online"));

/* =========================
   🔐 ENV
========================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

/* =========================
   🛡️ CONFIG
========================= */
const STAFF_ROLE = "1490431614055088128";

const EM_SERVICO = "1492553421973356795";
const FORA_SERVICO = "1492553631642288160";

/* =========================
   🧠 SISTEMA
========================= */
let config = { painel: null, msgId: null };

const pontos = new Map();
const ranking = new Map();

/* =========================
   🚀 CLIENT
========================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =========================
   ⏱ FUNÇÕES
========================= */
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

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

/* =========================
   👑 HIERARQUIA
========================= */
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509018", nome: "Diretor 2" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador 1" },
  { id: "1477683902121509014", nome: "Coordenador 2" }
];

/* =========================
   🔘 BOTÕES
========================= */
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

/* =========================
   📌 COMMANDS
========================= */
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ranking de horas"),

  new SlashCommandBuilder()
    .setName("abrirponto")
    .setDescription("Abrir ponto de alguém")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fecharponto")
    .setDescription("Fechar ponto de alguém")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addtempo")
    .setDescription("Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removertempo")
    .setDescription("Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos").setRequired(true)
    )
].map(c => c.toJSON());

/* =========================
   🔥 READY
========================= */
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  let updating = false;

  setInterval(async () => {
    if (updating) return;
    updating = true;

    try {
      await updatePanel();
    } catch (err) {
      console.error("Erro updatePanel:", err);
    } finally {
      updating = false;
    }
  }, 3000);
});

/* =========================
   🏥 PAINEL
========================= */
async function updatePanel() {
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
    .setDescription(`🏥 Hospital Bella

👨‍⚕️ EM SERVIÇO:
${list}

📊 Médicos ativos: ${pontos.size}`);

  await msg.edit({
    embeds: [embed],
    components: [row()]
  });
}

/* =========================
   🎯 INTERAÇÕES
========================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.member) return;

  if (interaction.isButton()) {
    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      if (pontos.has(id)) {
        return interaction.reply({ content: "❌ Já ativo", ephemeral: true });
      }

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
        content: `🔴 Finalizado • ${format(time)}`,
        ephemeral: true
      });
    }
  }
});

/* =========================
   🔑 LOGIN
========================= */
client.login(TOKEN);

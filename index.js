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

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1490431614055088128";

// 🏥 CARGOS DE STATUS
const EM_SERVICO = "1492553421973356795";
const FORA_SERVICO = "1492553631642288160";

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
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509019", nome: "Diretor 2" },
  { id: "1477683902121509020", nome: "Diretor 3" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador 1" },
  { id: "1477683902121509014", nome: "Coordenador 2" }
];

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
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ranking")
].map(c => c.toJSON());

// 🔥 READY
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
    } catch (e) {
      console.log(e.message);
    }
    updating = false;
  }, 3000);
});

// 🏥 PAINEL
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
    .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

👑 RESPONSÁVEL DO PLANTÃO
Sistema ativo

────────────────────────────

👨‍⚕️ EQUIPE EM SERVIÇO
${list}

────────────────────────────

📊 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>
`);

  await msg.edit({ embeds: [embed], components: [row()] });
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.member) return;

  const guild = interaction.guild;

  async function setStatusRoles(userId, inService) {
    const member = await guild.members.fetch(userId);

    if (inService) {
      await member.roles.add(EM_SERVICO).catch(() => {});
      await member.roles.remove(FORA_SERVICO).catch(() => {});
    } else {
      await member.roles.add(FORA_SERVICO).catch(() => {});
      await member.roles.remove(EM_SERVICO).catch(() => {});
    }
  }

  // COMMANDS
  if (interaction.isChatInputCommand()) {

    const member = interaction.member;

    if (!isStaff(member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 Painel ativo").setColor("#0f172a")],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

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

  // BUTTONS
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {

      if (pontos.has(id))
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      await setStatusRoles(id, true);

      return interaction.reply({ content: "🟢 Em serviço!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {

      const p = pontos.get(id);
      if (!p)
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const time = Date.now() - p.inicio;

      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      await setStatusRoles(id, false);

      return interaction.reply({
        content: `🔴 Fora de serviço • ${format(time)}`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);

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

// 🏥 CARGOS
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
  { id: "1477683902121509018", nome: "Diretor 2" },
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
    .setDescription("Adicionar horas a um usuário")
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
    .setDescription("Remover horas de um usuário")
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

// 🔥 READY
client.once("clientReady", async () => {
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
    .setDescription(`🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

👑 RESPONSÁVEL DO PLANTÃO
${getBossList(channel.guild)}

────────────────────────────
👨‍⚕️ EQUIPE EM SERVIÇO
${list}

────────────────────────────
📊 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

────────────────────────────
🚨 OBSERVAÇÕES
• Sistema automático de plantão
• Horas sendo contabilizadas em tempo real
• Use corretamente os botões

🏥 Hospital Bella • Sistema Profissional`);

  await msg.edit({
    embeds: [embed],
    components: [row()]
  });
}

// 👑 CHEFES
function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role) return `👑 Nenhum • ${r.nome}`;

    const member = role.members
      .filter(m => !usados.has(m.id))
      .first();

    if (!member) return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async interaction => {
  if (!interaction.member) return;

  const guild = interaction.guild;

  async function setStatus(userId, inService) {
    const member = await guild.members.fetch(userId);

    if (inService) {
      await member.roles.add(EM_SERVICO).catch(() => {});
      await member.roles.remove(FORA_SERVICO).catch(() => {});
    } else {
      await member.roles.add(FORA_SERVICO).catch(() => {});
      await member.roles.remove(EM_SERVICO).catch(() => {});
    }
  }

  // 🔹 COMMANDS
  if (interaction.isChatInputCommand()) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
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
        ephemeral: true
      });
    }

    if (interaction.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, t], i) => `#${i + 1} <@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Ranking de Horas")
            .setDescription(top || "Sem dados")
            .setColor("#0f172a")
        ]
      });
    }

    if (interaction.commandName === "abrirponto") {
      const user = interaction.options.getUser("usuario");

      if (pontos.has(user.id)) {
        return interaction.reply({
          content: "❌ Já está em serviço",
          ephemeral: true
        });
      }

      pontos.set(user.id, { inicio: Date.now() });
      await setStatus(user.id, true);

      return interaction.reply({
        content: `🟢 Ponto aberto para <@${user.id}>`
      });
    }

    if (interaction.commandName === "fecharponto") {
      const user = interaction.options.getUser("usuario");
      const p = pontos.get(user.id);

      if (!p) {
        return interaction.reply({
          content: "❌ Não está em serviço",
          ephemeral: true
        });
      }

      const time = Date.now() - p.inicio;

      ranking.set(user.id, (ranking.get(user.id) || 0) + time);
      pontos.delete(user.id);

      await setStatus(user.id, false);

      return interaction.reply({
        content: `🔴 Ponto fechado para <@${user.id}> • ${format(time)}`
      });
    }

    if (interaction.commandName === "addtempo") {
      const user = interaction.options.getUser("usuario");
      const horas = interaction.options.getInteger("horas");
      const minutos = interaction.options.getInteger("minutos");

      const ms = (horas * 60 + minutos) * 60000;

      ranking.set(user.id, (ranking.get(user.id) || 0) + ms);

      return interaction.reply({
        content: `➕ Adicionado ${horas}h ${minutos}m para <@${user.id}>`
      });
    }

    if (interaction.commandName === "removertempo") {
      const user = interaction.options.getUser("usuario");
      const horas = interaction.options.getInteger("horas");
      const minutos = interaction.options.getInteger("minutos");

      const ms = (horas * 60 + minutos) * 60000;
      const atual = ranking.get(user.id) || 0;

      ranking.set(user.id, Math.max(0, atual - ms));

      return interaction.reply({
        content: `➖ Removido ${horas}h ${minutos}m de <@${user.id}>`
      });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {
    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      if (pontos.has(id)) {
        return interaction.reply({
          content: "❌ Já está em serviço",
          ephemeral: true
        });
      }

      pontos.set(id, { inicio: Date.now() });
      await setStatus(id, true);

      return interaction.reply({
        content: "🟢 Iniciado!",
        ephemeral: true
      });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);

      if (!p) {
        return interaction.reply({
          content: "❌ Você não iniciou",
          ephemeral: true
        });
      }

      const time = Date.now() - p.inicio;

      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      await setStatus(id, false);

      return interaction.reply({
        content: `🔴 Finalizado • ${format(time)}`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);


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

app.get("/", (_, res) => {
  res.send("Bot online 🔥");
});

app.listen(3000, () => {
  console.log("🌐 Web online na porta 3000");
});

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
let config = {
  painel: null,
  msgId: null
};

const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🔥 REST
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

// 🛡️ VERIFICAÇÃO STAFF
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
    .addChannelOption(option =>
      option
        .setName("canal")
        .setDescription("Canal")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ranking")
].map(command => command.toJSON());

// 👑 FUNÇÃO CHEFES
function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(cargo => {
    const role = guild.roles.cache.get(cargo.id);

    if (!role) {
      return `👑 Nenhum • ${cargo.nome}`;
    }

    const member = role.members
      .filter(m => !usados.has(m.id))
      .first();

    if (!member) {
      return `👑 Nenhum • ${cargo.nome}`;
    }

    usados.add(member.id);

    return `👑 <@${member.id}> • ${cargo.nome}`;
  }).join("\n");
}

// 🏥 UPDATE PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);

    if (!channel) return;

    const msg = await channel.messages.fetch(config.msgId);

    if (!msg) return;

    let list = "";

    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;

      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) {
      list = "Nenhum médico em serviço";
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

 SISTEMA DE PLANTÃO EM FUNCIONAMENTO

 RESPONSÁVEL DO PLANTÃO
${getBossList(channel.guild)}

────────────────────────────

 EQUIPE EM SERVIÇO
${list}

────────────────────────────

 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

────────────────────────────

🚨 OBSERVAÇÕES
• Sistema automático de controle de plantão
• Registro de horas em tempo real
• Ranking atualizado continuamente
• Não deixe o ponto aberto

🏥 Hospital Bella • Sistema Profissional
`);

    await msg.edit({
      embeds: [embed],
      components: [row()]
    });

  } catch (err) {
    console.log("❌ Erro updatePanel:", err.message);
  }
}

// 🔥 READY
client.once("clientReady", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash commands registradas");

  } catch (err) {
    console.log("❌ Erro slash:", err.message);
  }

  let updating = false;

  setInterval(async () => {
    if (updating) return;

    updating = true;

    try {
      await updatePanel();
    } catch (err) {
      console.log("❌ Erro painel:", err.message);
    }

    updating = false;
  }, 3000);
});

// 🎯 INTERAÇÕES
client.on("interactionCreate", async interaction => {
  try {

    if (!interaction.guild || !interaction.member) return;

    const guild = interaction.guild;

    // 🔄 ALTERAR STATUS
    async function setStatus(userId, inService) {
      try {
        const member = await guild.members.fetch(userId);

        if (!member) return;

        if (inService) {
          await member.roles.add(EM_SERVICO).catch(() => {});
          await member.roles.remove(FORA_SERVICO).catch(() => {});
        } else {
          await member.roles.add(FORA_SERVICO).catch(() => {});
          await member.roles.remove(EM_SERVICO).catch(() => {});
        }

      } catch (err) {
        console.log("❌ Erro setStatus:", err.message);
      }
    }

    // 📌 SLASH COMMAND
    if (interaction.isChatInputCommand()) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Sem permissão",
          ephemeral: true
        });
      }

      // 🏥 /painelhp
      if (interaction.commandName === "painelhp") {

        const canal = interaction.options.getChannel("canal");

        if (!canal) {
          return interaction.reply({
            content: "❌ Canal inválido",
            ephemeral: true
          });
        }

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

        await updatePanel();

        return interaction.reply({
          content: "✅ Painel criado!",
          ephemeral: true
        });
      }

      // 🏆 /rankinghp
      if (interaction.commandName === "rankinghp") {

        const top = [...ranking.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, tempo]) => `👨‍⚕️ <@${id}> • ${format(tempo)}`)
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 Ranking Hospital")
              .setColor("#0f172a")
              .setDescription(top || "Sem dados")
          ]
        });
      }
    }

    // 🔘 BOTÕES
    if (interaction.isButton()) {

      const userId = interaction.user.id;

      // 🟢 INICIAR
      if (interaction.customId === "iniciar") {

        if (pontos.has(userId)) {
          return interaction.reply({
            content: "❌ Você já está em serviço",
            ephemeral: true
          });
        }

        pontos.set(userId, {
          inicio: Date.now()
        });

        await setStatus(userId, true);

        await updatePanel();

        return interaction.reply({
          content: "🟢 Plantão iniciado!",
          ephemeral: true
        });
      }

      // 🔴 FINALIZAR
      if (interaction.customId === "finalizar") {

        const ponto = pontos.get(userId);

        if (!ponto) {
          return interaction.reply({
            content: "❌ Você não iniciou o plantão",
            ephemeral: true
          });
        }

        const time = Date.now() - ponto.inicio;

        ranking.set(
          userId,
          (ranking.get(userId) || 0) + time
        );

        pontos.delete(userId);

        await setStatus(userId, false);

        await updatePanel();

        return interaction.reply({
          content: `🔴 Plantão finalizado • ${format(time)}`,
          ephemeral: true
        });
      }
    }

  } catch (err) {
    console.log("❌ interactionCreate:", err.message);
  }
});

// 🚀 LOGIN
client.login(TOKEN).catch(err => {
  console.log("❌ Erro login:", err.message);
});

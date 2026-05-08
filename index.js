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

// 🌐 WEB
const app = express();

app.get("/", (_, res) => {
  res.send("🔥 Bot online");
});

app.listen(3000, () => {
  console.log("🌐 WEB ONLINE");
});

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.log("❌ TOKEN não encontrada");
  process.exit(1);
}

// ⚙️ CONFIG
const TEMPO_MAXIMO = 7 * 60 * 60 * 1000;

// 🛡️ CARGOS
const STAFF_ROLE = "1490431614055088128";
const CARGO_ADV = "1477683902041690350";

const EM_SERVICO = "1492553421973356795";
const FORA_SERVICO = "1492553631642288160";

// 👑 HIERARQUIA
const HIERARQUIA = [

  // 👑 DIRETORES
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509019", nome: "Diretor 2" },
  { id: "1477683902121509020", nome: "Diretor 3" },

  // 🛡️ VICE DIRETORES
  { id: "1477683902121509021", nome: "Vice Diretor 1" },
  { id: "1477683902121509022", nome: "Vice Diretor 2" },

  // ⚕️ SUPERVISORES
  { id: "1477683902121509023", nome: "Supervisor 1" },
  { id: "1477683902121509024", nome: "Supervisor 2" },

  // 📋 COORDENADORES
  { id: "1477683902121509025", nome: "Coordenador 1" },
  { id: "1477683902121509026", nome: "Coordenador 2" }
];

// 🧠 SISTEMA
let config = {
  painel: null,
  logs: null,
  msgId: null
};

const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// 🔥 REST
const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [

  // 🏥 PAINEL
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(option =>
      option
        .setName("canal")
        .setDescription("Canal do painel")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName("logs")
        .setDescription("Canal de logs")
        .setRequired(true)
    ),

  // 🏆 RANKING
  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking hospital"),

  // 🟢 ADD SERVIÇO
  new SlashCommandBuilder()
    .setName("addservico")
    .setDescription("Adicionar usuário em serviço")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Selecione o usuário")
        .setRequired(true)
    ),

  // 🔴 RETIRAR SERVIÇO
  new SlashCommandBuilder()
    .setName("retirarservico")
    .setDescription("Retirar usuário de serviço")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Selecione o usuário")
        .setRequired(true)
    )

].map(command => command.toJSON());

// 🧠 FORMATAR TEMPO
function format(ms) {

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);

  return `${h}h ${m}m`;
}

function tempoRelativo(ms) {

  const m = Math.floor(ms / 60000);

  if (m < 1) return "há poucos segundos";
  if (m === 1) return "há 1 minuto";

  return `há ${m} minutos`;
}

// 🛡️ STAFF
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES
function row() {

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("🟢 Entrar em Serviço")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("finalizar")
      .setLabel("🔴 Retirar de Serviço")
      .setStyle(ButtonStyle.Danger)
  );
}

// 👑 RESPONSÁVEIS
function getBossList(guild) {

  let lista = "";

  for (const cargo of HIERARQUIA) {

    // pega cargo
    const role = guild.roles.cache.get(cargo.id);

    // cargo inexistente
    if (!role) {
      lista += `❌ Cargo não encontrado • ${cargo.nome}\n`;
      continue;
    }

    // pega SOMENTE quem está em serviço
    const membros = role.members.filter(member =>
      pontos.has(member.id)
    );

    // ninguém em serviço
    if (membros.size === 0) {
      lista += `⚫ Nenhum em serviço • ${cargo.nome}\n`;
      continue;
    }

    // mostra todos corretamente
    for (const member of membros.values()) {

      lista += `👑 ${member.user.tag} • ${cargo.nome}\n`;
    }
  }

  return lista || "Nenhum responsável em serviço";
}

// 💎 LOGS
async function sendLog(embed) {

  try {

    if (!config.logs) return;

    const canal = await client.channels.fetch(config.logs).catch(() => null);

    if (!canal || !canal.isTextBased()) return;

    await canal.send({
      embeds: [embed]
    });

  } catch (err) {

    console.log("❌ LOG:", err.message);
  }
}

// 🔄 STATUS
async function setStatus(guild, userId, inService) {

  try {

    const member = await guild.members.fetch(userId);

    if (!member) return;

    // 🟢 ENTRAR
    if (inService) {

      await member.roles.add(EM_SERVICO).catch(() => {});
      await member.roles.remove(FORA_SERVICO).catch(() => {});

    }

    // 🔴 RETIRAR
    else {

      await member.roles.add(FORA_SERVICO).catch(() => {});
      await member.roles.remove(EM_SERVICO).catch(() => {});
    }

  } catch (err) {

    console.log("❌ STATUS:", err.message);
  }
}

// 🏥 UPDATE PANEL
async function updatePanel() {

  try {

    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel).catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    const msg = await channel.messages.fetch(config.msgId).catch(() => null);

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
    }

    if (pontos.size === 0) {

      lista = "❌ Nenhum médico em serviço";

    } else {

      for (const [id, data] of pontos) {

        const tempo = Date.now() - data.inicio;

        lista += `👨‍⚕️ <@${id}> • ${tempoRelativo(tempo)}\n`;
      }
    }

    let chefeInfo = "Nenhum";

    if (chefe) {
      chefeInfo = `<@${chefe}> • ${format(maiorTempo)}`;
    }

    let status = "🔴 CRÍTICO";

    if (pontos.size >= 3) {
      status = "🟢 NORMAL";
    } else if (pontos.size >= 1) {
      status = "🟡 BAIXO EFETIVO";
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

🏥 SISTEMA HOSPITALAR ATIVO

────────────────────────────

👑 RESPONSÁVEL DO PLANTÃO
${chefeInfo}

────────────────────────────

👑 HIERARQUIA EM SERVIÇO
${getBossList(channel.guild)}

────────────────────────────

👨‍⚕️ EQUIPE EM SERVIÇO
${lista}

────────────────────────────

📊 STATUS DO HOSPITAL

👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>
🚨 Situação atual: ${status}

────────────────────────────

⚠️ SISTEMA AUTOMÁTICO
• Controle de plantão
• Controle de tempo
• Advertência automática
• Logs automáticos
• Atualização em tempo real

────────────────────────────

🏥 Hospital Bella • Sistema Profissional
`)
      .setTimestamp();

    await msg.edit({
      embeds: [embed],
      components: [row()]
    });

  } catch (err) {

    console.log("❌ updatePanel:", err.message);
  }
}

// 🚨 TEMPO
async function verificarTempo() {

  for (const [id, data] of pontos) {

    try {

      const tempo = Date.now() - data.inicio;

      if (tempo < TEMPO_MAXIMO) continue;

      const guild = client.guilds.cache.first();

      if (!guild) continue;

      const membro = await guild.members.fetch(id).catch(() => null);

      if (!membro) continue;

      await membro.roles.add(CARGO_ADV).catch(() => {});

      pontos.delete(id);

      await setStatus(guild, id, false);

      await updatePanel();

      await sendLog(
        new EmbedBuilder()
          .setColor("#dc2626")
          .setTitle("🚨 ADVERTÊNCIA AUTOMÁTICA")
          .setDescription(`
👨‍⚕️ Usuário: <@${id}>
⏰ Motivo: Passou de 7h em serviço
⚠️ Advertência aplicada automaticamente
`)
      );

    } catch (err) {

      console.log("❌ verificarTempo:", err.message);
    }
  }
}

// 🔥 READY
client.once("ready", async () => {

  console.log(`🔥 ONLINE: ${client.user.tag}`);

  try {

    if (CLIENT_ID && GUILD_ID) {

      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );

    } else {

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
    }

    console.log("✅ COMANDOS REGISTRADOS");

  } catch (err) {

    console.log("❌ SLASH:", err.message);
  }

  // 🔄 UPDATE
  setInterval(async () => {

    try {
      await updatePanel();
    } catch (err) {
      console.log(err);
    }

  }, 30000);

  // 🚨 TEMPO
  setInterval(async () => {

    try {
      await verificarTempo();
    } catch (err) {
      console.log(err);
    }

  }, 60000);
});

// 🎯 INTERAÇÕES
client.on("interactionCreate", async interaction => {

  try {

    if (!interaction.guild || !interaction.member) return;

    const guild = interaction.guild;

    // 📌 COMANDOS
    if (interaction.isChatInputCommand()) {

      if (!isStaff(interaction.member)) {

        return interaction.reply({
          content: "❌ Sem permissão",
          ephemeral: true
        });
      }

      // 🏥 PAINEL
      if (interaction.commandName === "painelhp") {

        const canal = interaction.options.getChannel("canal");
        const logs = interaction.options.getChannel("logs");

        if (!canal || !logs) {

          return interaction.reply({
            content: "❌ Canal inválido",
            ephemeral: true
          });
        }

        config.painel = canal.id;
        config.logs = logs.id;

        const msg = await canal.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#0f172a")
              .setDescription(`
🏥 PAINEL HOSPITALAR INICIADO

Use os botões abaixo para entrar ou retirar de serviço.
`)
          ],
          components: [row()]
        });

        config.msgId = msg.id;

        await updatePanel();

        return interaction.reply({
          content: "✅ Painel criado com sucesso",
          ephemeral: true
        });
      }

      // 🏆 RANKING
      if (interaction.commandName === "rankinghp") {

        const top = [...ranking.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, tempo], index) =>
            `#${index + 1} • 👨‍⚕️ <@${id}> • ${format(tempo)}`
          )
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 Ranking Hospital")
              .setColor("#0f172a")
              .setDescription(top || "❌ Sem dados registrados")
          ]
        });
      }

      // 🟢 ADD SERVIÇO
      if (interaction.commandName === "addservico") {

        const usuario = interaction.options.getUser("usuario");

        if (!usuario) {

          return interaction.reply({
            content: "❌ Usuário inválido",
            ephemeral: true
          });
        }

        if (pontos.has(usuario.id)) {

          return interaction.reply({
            content: "❌ Usuário já está em serviço",
            ephemeral: true
          });
        }

        pontos.set(usuario.id, {
          inicio: Date.now()
        });

        await setStatus(guild, usuario.id, true);

        await updatePanel();

        return interaction.reply({
          content: `✅ ${usuario} foi adicionado em serviço`,
          ephemeral: true
        });
      }

      // 🔴 RETIRAR SERVIÇO
      if (interaction.commandName === "retirarservico") {

        const usuario = interaction.options.getUser("usuario");

        if (!usuario) {

          return interaction.reply({
            content: "❌ Usuário inválido",
            ephemeral: true
          });
        }

        const ponto = pontos.get(usuario.id);

        if (!ponto) {

          return interaction.reply({
            content: "❌ Usuário não está em serviço",
            ephemeral: true
          });
        }

        const tempo = Date.now() - ponto.inicio;

        ranking.set(
          usuario.id,
          (ranking.get(usuario.id) || 0) + tempo
        );

        pontos.delete(usuario.id);

        await setStatus(guild, usuario.id, false);

        await updatePanel();

        return interaction.reply({
          content: `✅ ${usuario} foi retirado de serviço`,
          ephemeral: true
        });
      }
    }

    // 🔘 BOTÕES
    if (interaction.isButton()) {

      const userId = interaction.user.id;

      // 🟢 ENTRAR
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

        await setStatus(guild, userId, true);

        await updatePanel();

        return interaction.reply({
          content: "🟢 Você entrou em serviço",
          ephemeral: true
        });
      }

      // 🔴 RETIRAR
      if (interaction.customId === "finalizar") {

        const ponto = pontos.get(userId);

        if (!ponto) {

          return interaction.reply({
            content: "❌ Você não está em serviço",
            ephemeral: true
          });
        }

        const tempo = Date.now() - ponto.inicio;

        ranking.set(
          userId,
          (ranking.get(userId) || 0) + tempo
        );

        pontos.delete(userId);

        await setStatus(guild, userId, false);

        await updatePanel();

        return interaction.reply({
          content: `🔴 Você saiu de serviço • ${format(tempo)}`,
          ephemeral: true
        });
      }
    }

  } catch (err) {

    console.log("❌ interactionCreate:", err);
  }
});

// 🛡️ ANTI-CRASH
process.on("unhandledRejection", err => {
  console.log("❌ unhandledRejection:", err);
});

process.on("uncaughtException", err => {
  console.log("❌ uncaughtException:", err);
});

// 🚀 LOGIN
client.login(TOKEN).catch(err => {
  console.log("❌ LOGIN:", err.message);
});

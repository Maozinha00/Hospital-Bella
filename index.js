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

// 🛡️ STAFF
const STAFF_ROLE = "1490431614055088128";

// 🏥 STATUS
const EM_SERVICO = "1492553421973356795";
const FORA_SERVICO = "1492553631642288160";

// 📌 HIERARQUIA
const CANAL_HIERARQUIA = "1477683905187414165";
const ROLE_BASE = "1477683902079303932";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FORMAT
const format = ms => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

// 👑 PAINEL HIERARQUIA
const HIERARQUIA_PAINEL = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" }
];

function getBossList(guild) {
  return HIERARQUIA_PAINEL.map(r => {
    const role = guild.roles.cache.get(r.id);
    const member = role?.members.first();
    return member
      ? `👑 <@${member.id}> • ${r.nome}`
      : `👑 Nenhum • ${r.nome}`;
  }).join("\n");
}

// 📋 HIERARQUIA COMPLETA
async function gerarHierarquia(guild) {
  const baseRole = guild.roles.cache.get(ROLE_BASE);
  if (!baseRole) return "❌ Cargo base não encontrado";

  const grupos = {
    "RESP.HP": [],
    DIR: [],
    VD: [],
    SUP: [],
    COD: [],
    MED: [],
    ENF: [],
    PARM: []
  };

  baseRole.members.forEach(member => {
    const nome = member.nickname || member.user.username;

    const siglaMatch = nome.match(/\[(.*?)\]/);
    if (!siglaMatch) return;

    const sigla = siglaMatch[1];

    const nomeLimpo = nome.replace(/\[.*?\]/, "").trim();
    const matchId = nomeLimpo.match(/\|\s*(\d+)/);

    const nomeFinal = nomeLimpo.split("|")[0].trim();
    const id = matchId ? matchId[1] : "Sem ID";

    const linha = `• [${sigla}] ${nomeFinal} | ${id}`;

    if (grupos[sigla]) {
      grupos[sigla].push(linha);
    }
  });

  return `🔰 HIERARQUIA DO HOSPITAL HP 🔰

━━━━━━━━━━━━━━━━━━━━━━

✅ RESPONSÁVEL DO HP
${grupos["RESP.HP"].join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ DIRETORIA GERAL
${grupos.DIR.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ VICE DIRETORIA
${grupos.VD.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ SUPERVISOR
${grupos.SUP.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ COORDENADOR
${grupos.COD.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ MÉDICO
${grupos.MED.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ ENFERMEIRO
${grupos.ENF.join("\n") || "• Nenhum"}

━━━━━━━━━━━━━━━━━━━━━━

✅ PARAMEDICO
${grupos.PARM.join("\n") || "• Nenhum"}
`;
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
  );
}

// 📌 COMMANDS (CORRIGIDOS)
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking de horas"),

  new SlashCommandBuilder()
    .setName("abrirponto")
    .setDescription("Abrir ponto de um usuário")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fecharponto")
    .setDescription("Fechar ponto de um usuário")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addtempo")
    .setDescription("Adicionar tempo")
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
    .setDescription("Remover tempo")
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
    .setName("hierarquiahp")
    .setDescription("Enviar hierarquia")
].map(c => c.toJSON());

// 🚀 READY
client.once("clientReady", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 3000);
});

// 🏥 PAINEL
async function updatePanel() {
  if (!config.painel || !config.msgId) return;

  const channel = await client.channels.fetch(config.painel);
  const msg = await channel.messages.fetch(config.msgId);

  let list = "";
  for (const [id, data] of pontos) {
    const time = Date.now() - data.inicio;
    list += `👨‍⚕️ <@${id}> • há ${Math.floor(time / 60000)} min\n`;
  }

  if (!list) list = "Nenhum em serviço";

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`🏥 HOSPITAL HP

👑 CHEFIA
${getBossList(channel.guild)}

━━━━━━━━━━━━━━━━━━━━━━
👨‍⚕️ EM SERVIÇO
${list}

👥 Ativos: ${pontos.size}
🕒 <t:${Math.floor(Date.now()/1000)}:R>`);

  await msg.edit({ embeds: [embed], components: [row()] });
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async interaction => {
  if (!interaction.member) return;

  if (interaction.isChatInputCommand()) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE))
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 Painel ativo")],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, t], i) => `#${i + 1} <@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(top || "Sem dados")]
      });
    }

    if (interaction.commandName === "hierarquiahp") {
      const canal = await interaction.guild.channels.fetch(CANAL_HIERARQUIA);
      const msg = await gerarHierarquia(interaction.guild);

      await canal.send({ content: msg });

      return interaction.reply({ content: "✅ Hierarquia enviada!", ephemeral: true });
    }

    if (interaction.commandName === "addtempo") {
      const user = interaction.options.getUser("usuario");
      const horas = interaction.options.getInteger("horas");
      const minutos = interaction.options.getInteger("minutos");

      const ms = (horas * 60 + minutos) * 60000;
      ranking.set(user.id, (ranking.get(user.id) || 0) + ms);

      return interaction.reply(`➕ ${horas}h ${minutos}m para <@${user.id}>`);
    }

    if (interaction.commandName === "removertempo") {
      const user = interaction.options.getUser("usuario");
      const horas = interaction.options.getInteger("horas");
      const minutos = interaction.options.getInteger("minutos");

      const ms = (horas * 60 + minutos) * 60000;
      const atual = ranking.get(user.id) || 0;

      ranking.set(user.id, Math.max(0, atual - ms));

      return interaction.reply(`➖ ${horas}h ${minutos}m de <@${user.id}>`);
    }

    if (interaction.commandName === "abrirponto") {
      const user = interaction.options.getUser("usuario");
      pontos.set(user.id, { inicio: Date.now() });
      return interaction.reply(`🟢 Ponto aberto para <@${user.id}>`);
    }

    if (interaction.commandName === "fecharponto") {
      const user = interaction.options.getUser("usuario");
      const p = pontos.get(user.id);
      if (!p) return interaction.reply("❌ Não está em serviço");

      const time = Date.now() - p.inicio;
      ranking.set(user.id, (ranking.get(user.id) || 0) + time);
      pontos.delete(user.id);

      return interaction.reply(`🔴 ${format(time)}`);
    }
  }

  if (interaction.isButton()) {
    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return;

      const time = Date.now() - p.inicio;
      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      return interaction.reply({ content: `🔴 ${format(time)}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);

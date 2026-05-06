import "dotenv/config";
import express from "express";
import fs from "fs";
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

/* ================= WEB ================= */
const app = express();
app.get("/", (_, res) => res.send("🔥 Bot online"));
app.listen(process.env.PORT || 3000);

/* ================= ENV ================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

/* ================= FILES ================= */
const pontosFile = "./pontos.json";
const rankingFile = "./ranking.json";
const configFile = "./config.json";

const read = (f) => JSON.parse(fs.readFileSync(f));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let pontos = read(pontosFile);
let ranking = read(rankingFile);
let config = read(configFile);

/* ================= CONFIG ================= */
const STAFF_ROLE = "1490431614055088128";

/* ================= HIERARQUIA ================= */
const HIERARQUIA = [
  { role: "1477683902121509018", nome: "👑 Diretor" },
  { role: "1477683902121509017", nome: "🧠 Vice Diretor" },
  { role: "1477683902121509016", nome: "🛡️ Supervisor" },
  { role: "1477683902121509015", nome: "📋 Coordenador" },
  { role: "1477683902121509014", nome: "👨‍⚕️ Médico" }
];

function getCargo(member) {
  for (const h of HIERARQUIA) {
    if (member.roles.cache.has(h.role)) return h.nome;
  }
  return "👤 Funcionário";
}

/* ================= CLIENT ================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ================= FUNÇÕES ================= */
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function isStaff(member) {
  return member.roles.cache.has(STAFF_ROLE);
}

/* ================= BOTÕES ================= */
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

/* ================= COMMANDS ================= */
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel")
    .addChannelOption(o => o.setName("canal").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("addtempo")
    .setDescription("Adicionar tempo")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("horas").setRequired(true))
    .addIntegerOption(o => o.setName("minutos").setRequired(true))
].map(c => c.toJSON());

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 5000);
});

/* ================= PAINEL ================= */
async function updatePanel() {
  if (!config.painel || !config.msgId) return;

  try {
    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const id in pontos) {
      try {
        const member = await client.guilds.cache
          .get(GUILD_ID)
          .members.fetch(id);

        const cargo = getCargo(member);
        const tempo = Date.now() - pontos[id].inicio;

        list += `${cargo} <@${id}> • ${format(tempo)}\n`;
      } catch {
        list += `👤 <@${id}> • erro\n`;
      }
    }

    if (!list) list = "Ninguém em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`🏥 Hospital

👨‍⚕️ EM SERVIÇO:
${list}

📊 Ativos: ${Object.keys(pontos).length}`);

    await msg.edit({
      embeds: [embed],
      components: [row()]
    });

  } catch {
    config = {};
    write(configFile, config);
  }
}

/* ================= INTERAÇÕES ================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.member) return;

  /* BOTÕES */
  if (interaction.isButton()) {
    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      if (pontos[id])
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });

      pontos[id] = { inicio: Date.now() };
      write(pontosFile, pontos);

      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      if (!pontos[id])
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const tempo = Date.now() - pontos[id].inicio;

      ranking[id] = (ranking[id] || 0) + tempo;

      delete pontos[id];

      write(pontosFile, pontos);
      write(rankingFile, ranking);

      return interaction.reply({
        content: `🔴 Finalizado • ${format(tempo)}`,
        ephemeral: true
      });
    }
  }

  /* COMANDOS */
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "painelhp") {
      if (!isStaff(interaction.member))
        return interaction.reply("❌ Sem permissão");

      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("Carregando...")],
        components: [row()]
      });

      config = { painel: canal.id, msgId: msg.id };
      write(configFile, config);

      return interaction.reply("✅ Painel criado");
    }

    if (interaction.commandName === "rankinghp") {
      let arr = Object.entries(ranking)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      let txt = "";

      for (let i = 0; i < arr.length; i++) {
        try {
          const member = await interaction.guild.members.fetch(arr[i][0]);
          const cargo = getCargo(member);

          txt += `#${i + 1} ${cargo} <@${arr[i][0]}> • ${format(arr[i][1])}\n`;
        } catch {
          txt += `#${i + 1} 👤 <@${arr[i][0]}> • ${format(arr[i][1])}\n`;
        }
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#22c55e")
            .setTitle("🏆 Ranking Hospital")
            .setDescription(txt || "Sem dados")
        ]
      });
    }

    if (interaction.commandName === "addtempo") {
      const cargo = getCargo(interaction.member);

      if (!cargo.includes("Diretor"))
        return interaction.reply("❌ Apenas Diretor pode usar isso");

      const user = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos");

      const tempo = (h * 60 + m) * 60000;

      ranking[user.id] = (ranking[user.id] || 0) + tempo;
      write(rankingFile, ranking);

      return interaction.reply("✅ Tempo adicionado");
    }
  }
});

/* ================= LOGIN ================= */
client.login(TOKEN);

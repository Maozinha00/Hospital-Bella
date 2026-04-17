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

// 📁 DATABASE
const DB_FILE = "./db.json";

let db = {
  painel: null,
  msgId: null,
  pontos: {},
  ranking: {}
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 🚀 CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
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

async function getBossList(guild) {
  await guild.members.fetch();

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
  return member.roles.cache.has(STAFF_ROLE);
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
      o.setName("canal").setRequired(true)),

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

  setInterval(updatePanel, 10000);
});

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!db.painel || !db.msgId) return;

    const channel = await client.channels.fetch(db.painel);
    const msg = await channel.messages.fetch(db.msgId);

    let list = "";

    for (const id in db.pontos) {
      const time = Date.now() - db.pontos[id];
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

** 👑 RESPONSÁVEL **
${await getBossList(channel.guild)}

────────────────────────────
** 👨‍⚕️ EM SERVIÇO **
${list}

────────────────────────────
📊 Médicos ativos: ${Object.keys(db.pontos).length}
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch {}
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!isStaff(member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      db.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 Painel ativo")],
        components: [row()]
      });

      db.msgId = msg.id;
      saveDB();

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const top = Object.entries(db.ranking)
        .sort((a,b) => b[1]-a[1])
        .map(([id,t]) => `<@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(top || "Sem dados")]
      });
    }
  }

  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {

      if (db.pontos[id]) {
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });
      }

      db.pontos[id] = Date.now();
      saveDB();

      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {

      if (!db.pontos[id]) {
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });
      }

      const time = Date.now() - db.pontos[id];

      db.ranking[id] = (db.ranking[id] || 0) + time;
      delete db.pontos[id];

      saveDB();

      return interaction.reply({ content: `🔴 Finalizado • ${format(time)}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);

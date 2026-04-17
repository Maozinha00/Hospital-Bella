import "dotenv/config";
import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
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
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Falta configurar .env");
  process.exit(1);
}

// 🛡️ STAFF
const STAFF_ROLE = "1490431614055088128";

// 🏥 CARGOS
const CARGO_EM_SERVICO = "1492553421973356795";
const CARGO_FORA_SERVICO = "1492553631642288160";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();

// 🗄️ BANCO
let db;

async function initDB() {
  db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ranking (
      userId TEXT PRIMARY KEY,
      tempo INTEGER DEFAULT 0
    );
  `);

  console.log("💾 Banco conectado");
}

// 📊 DB
async function addTempo(userId, tempo) {
  const row = await db.get("SELECT * FROM ranking WHERE userId = ?", userId);

  if (row) {
    await db.run(
      "UPDATE ranking SET tempo = tempo + ? WHERE userId = ?",
      tempo,
      userId
    );
  } else {
    await db.run(
      "INSERT INTO ranking (userId, tempo) VALUES (?, ?)",
      userId,
      tempo
    );
  }
}

async function getRanking() {
  return await db.all("SELECT * FROM ranking ORDER BY tempo DESC");
}

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
  return `há ${m} min`;
}

// 👑 HIERARQUIA (AGORA MOSTRA TODOS)
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

function getBossList(guild) {
  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);

    if (!role || role.members.size === 0) {
      return `👑 Nenhum • ${r.nome}`;
    }

    const membros = role.members.map(m => `<@${m.id}>`).join(", ");
    return `👑 ${membros} • ${r.nome}`;
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
    .setDescription("Criar painel")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await initDB();

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
});

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Nenhum em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 **HOSPITAL BELLA**

👑 **Responsáveis**
${getBossList(channel.guild)}

──────────────

👨‍⚕️ **Em serviço**
${list}

──────────────

👥 ${pontos.size} ativos
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (e) {
    console.log("Erro painel:", e.message);
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("Painel ativo")],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Criado", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const data = await getRanking();

      const top = data.map(r =>
        `<@${r.userId}> • ${format(r.tempo)}`
      ).join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Ranking")
            .setDescription(top || "Sem dados")
        ]
      });
    }
  }

  if (interaction.isButton()) {

    const id = interaction.user.id;
    const member = await interaction.guild.members.fetch(id).catch(() => null);
    if (!member) return;

    // 🟢 INICIAR
    if (interaction.customId === "iniciar") {
      if (pontos.has(id)) {
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });
      }

      pontos.set(id, { inicio: Date.now() });

      await member.roles.add(CARGO_EM_SERVICO).catch(() => {});
      await member.roles.remove(CARGO_FORA_SERVICO).catch(() => {});

      return interaction.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    // 🔴 FINALIZAR
    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);

      if (!p) {
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });
      }

      const time = Date.now() - p.inicio;

      await addTempo(id, time);
      pontos.delete(id);

      await member.roles.remove(CARGO_EM_SERVICO).catch(() => {});
      await member.roles.add(CARGO_FORA_SERVICO).catch(() => {});

      return interaction.reply({
        content: `🔴 Finalizado • ${format(time)}`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);

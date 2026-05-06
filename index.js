import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
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

app.get("/ranking", async (_, res) => {
  const data = await PontoDB.find().sort({ total: -1 }).limit(20);

  let html = "<h1>🏥 Ranking Hospital</h1>";
  data.forEach(u => {
    html += `<p>${u.userId} - ${format(u.total)}</p>`;
  });

  res.send(html);
});

app.listen(process.env.PORT || 3000);

/* ================= ENV ================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI);

const schema = new mongoose.Schema({
  userId: String,
  inicio: Number,
  total: { type: Number, default: 0 },
  ativo: Boolean
});

const PontoDB = mongoose.model("pontos", schema);

/* ================= CONFIG ================= */
const STAFF_ROLE = "1490431614055088128";

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
    .addChannelOption(o =>
      o.setName("canal").setRequired(true)
    ),

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
let painel = null;
let msgId = null;

client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 3000);
});

/* ================= PAINEL ================= */
async function updatePanel() {
  if (!painel || !msgId) return;

  const channel = await client.channels.fetch(painel);
  const msg = await channel.messages.fetch(msgId);

  const ativos = await PontoDB.find({ ativo: true });

  let list = "";

  ativos.forEach(p => {
    const tempo = Date.now() - p.inicio;
    list += `<@${p.userId}> • ${format(tempo)}\n`;
  });

  if (!list) list = "Ninguém em serviço";

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`🏥 Hospital

👨‍⚕️ EM SERVIÇO:
${list}

📊 Ativos: ${ativos.length}`);

  await msg.edit({
    embeds: [embed],
    components: [row()]
  });
}

/* ================= INTERAÇÕES ================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.member) return;

  /* BOTÕES */
  if (interaction.isButton()) {
    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      const existe = await PontoDB.findOne({ userId: id, ativo: true });

      if (existe)
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });

      await PontoDB.create({
        userId: id,
        inicio: Date.now(),
        ativo: true
      });

      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = await PontoDB.findOne({ userId: id, ativo: true });

      if (!p)
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const tempo = Date.now() - p.inicio;

      p.total += tempo;
      p.ativo = false;
      await p.save();

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

      painel = canal.id;
      msgId = msg.id;

      return interaction.reply("✅ Painel criado");
    }

    if (interaction.commandName === "rankinghp") {
      const top = await PontoDB.find().sort({ total: -1 }).limit(10);

      let txt = "";

      top.forEach((u, i) => {
        txt += `#${i + 1} <@${u.userId}> • ${format(u.total)}\n`;
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#22c55e")
            .setTitle("🏆 Ranking")
            .setDescription(txt || "Sem dados")
        ]
      });
    }

    if (interaction.commandName === "addtempo") {
      if (!isStaff(interaction.member))
        return interaction.reply("❌ Sem permissão");

      const user = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos");

      const tempo = (h * 60 + m) * 60000;

      let db = await PontoDB.findOne({ userId: user.id });

      if (!db) {
        db = await PontoDB.create({ userId: user.id, total: tempo });
      } else {
        db.total += tempo;
        await db.save();
      }

      return interaction.reply("✅ Tempo adicionado");
    }
  }
});

/* ================= LOGIN ================= */
client.login(TOKEN);

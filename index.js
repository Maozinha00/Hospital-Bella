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

// 📁 BANCO (salva painel)
const DB_FILE = "./config.json";
let config = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE))
  : { painel: null, msgId: null };

function saveConfig() {
  fs.writeFileSync(DB_FILE, JSON.stringify(config, null, 2));
}

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";
const EM_SERVICO = "1492553421973356795";
const FORA_SERVICO = "1492553631642288160";
const LOG_CHANNEL = "1495370353193521182";

// 🧠 SISTEMA
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
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms % 3600000 / 60000);
  return `${h}h ${m}m`;
}

function tempoRelativo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "agora mesmo";
  if (m === 1) return "há 1 min";
  return `há ${m} min`;
}

// 🧾 LOG
async function sendLog(guild, texto) {
  try {
    const canal = await guild.channels.fetch(LOG_CHANNEL);
    if (!canal) return;

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(texto)
      .setTimestamp();

    canal.send({ embeds: [embed] });
  } catch (e) {
    console.log("Erro log:", e.message);
  }
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
    .setDescription("Ranking"),

  new SlashCommandBuilder()
    .setName("abrirponto")
    .setDescription("Abrir ponto")
    .addUserOption(o =>
      o.setName("usuario").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fecharponto")
    .setDescription("Fechar ponto")
    .addUserOption(o =>
      o.setName("usuario").setRequired(true)
    )
].map(c => c.toJSON());

// 🔥 READY
client.once("clientReady", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 5000);
});

// 🏥 PAINEL
async function updatePanel() {
  if (!config.painel || !config.msgId) return;

  try {
    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Ninguém em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 **HOSPITAL BELLA**

👥 Em serviço:
${list}

🧑‍⚕️ Total: ${pontos.size}
🕒 Atualizado agora
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (e) {
    console.log("Erro painel:", e.message);
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.member) return;
  const guild = interaction.guild;

  async function setStatus(userId, ativo) {
    const member = await guild.members.fetch(userId);

    if (ativo) {
      await member.roles.add(EM_SERVICO).catch(() => {});
      await member.roles.remove(FORA_SERVICO).catch(() => {});
    } else {
      await member.roles.add(FORA_SERVICO).catch(() => {});
      await member.roles.remove(EM_SERVICO).catch(() => {});
    }
  }

  // 🔹 COMMANDS
  if (interaction.isChatInputCommand()) {

    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      const msg = await canal.send({
        content: "Carregando painel...",
        components: [row()]
      });

      config.painel = canal.id;
      config.msgId = msg.id;
      saveConfig();

      await updatePanel();

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

    if (interaction.commandName === "abrirponto") {
      const user = interaction.options.getUser("usuario");

      pontos.set(user.id, { inicio: Date.now() });
      await setStatus(user.id, true);

      await sendLog(guild, `🟢 <@${user.id}> teve ponto aberto por <@${interaction.user.id}>`);

      updatePanel();

      return interaction.reply({ content: `🟢 Aberto para <@${user.id}>` });
    }

    if (interaction.commandName === "fecharponto") {
      const user = interaction.options.getUser("usuario");
      const p = pontos.get(user.id);

      if (!p)
        return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });

      const time = Date.now() - p.inicio;

      ranking.set(user.id, (ranking.get(user.id) || 0) + time);
      pontos.delete(user.id);

      await setStatus(user.id, false);

      await sendLog(guild, `🔴 <@${user.id}> saiu do serviço • ${format(time)}`);

      updatePanel();

      return interaction.reply({ content: `🔴 Fechado • ${format(time)}` });
    }
  }

  // 🔘 BOTÕES
  if (interaction.isButton()) {

    const id = interaction.user.id;

    if (interaction.customId === "iniciar") {
      if (pontos.has(id))
        return interaction.reply({ content: "❌ Já ativo", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      await setStatus(id, true);

      await sendLog(guild, `🟢 <@${id}> entrou em serviço`);

      updatePanel();

      return interaction.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);

      if (!p)
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const time = Date.now() - p.inicio;

      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      await setStatus(id, false);

      await sendLog(guild, `🔴 <@${id}> saiu do serviço • ${format(time)}`);

      updatePanel();

      return interaction.reply({ content: `🔴 Finalizado • ${format(time)}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);

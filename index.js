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

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🤖 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ UTIL
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function tempo(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "há poucos segundos" : `há ${m} min`;
}

// 👑 HIERARQUIA (3 DIRETORES OK)
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509019", nome: "Diretor 2" },
  { id: "1477683902121509020", nome: "Diretor 3" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador 1" },
  { id: "1477683902121509014", nome: "Coordenador 2" }
];

function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role) return `👑 Nenhum • ${r.nome}`;

    const member = role.members.find(m => !usados.has(m.id));
    if (!member) return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

// 🔐 PERMISSÃO
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

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar tempo")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas"))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos")),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover tempo")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas"))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos")),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("TOP 3")
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 3000);
});

// 🏥 PAINEL HP
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      list += `👨‍⚕️ <@${id}> • ${tempo(Date.now() - data.inicio)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#00bfff")
      .setDescription(`
🏥 **HOSPITAL BELLA**

👑 HIERARQUIA
${getBossList(channel.guild)}

────────────────────

👨‍⚕️ EM SERVIÇO
${list}

────────────────────

📊 Ativos: ${pontos.size}
🕒 Atualização: 3s

🏥 Sistema ativo
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch {}
}

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (!isStaff(i.member))
      return i.reply({ content: "❌ Sem permissão", ephemeral: true });

    const user = i.options.getUser("usuario");

    const h = i.options.getInteger("horas") || 0;
    const m = i.options.getInteger("minutos") || 0;
    const tempoMs = (h * 3600000) + (m * 60000);

    // ➕ ADD HORA
    if (i.commandName === "addhora") {
      ranking.set(user.id, (ranking.get(user.id) || 0) + tempoMs);
      return i.reply({ content: "✅ Adicionado", ephemeral: true });
    }

    // ➖ REMOVER HORA
    if (i.commandName === "removerhora") {
      ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - tempoMs));
      return i.reply({ content: "❌ Removido", ephemeral: true });
    }

    // 🏆 RANKING
    if (i.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a,b)=>b[1]-a[1])
        .slice(0,3)
        .map(([id,t],i)=>`${i+1}º <@${id}> • ${format(t)}`)
        .join("\n");

      return i.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 TOP 3").setDescription(top || "Sem dados")]
      });
    }

    // 🏥 PAINEL
    if (i.commandName === "painelhp") {
      const canal = i.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 PAINEL ATIVO")],
        components: [row()]
      });

      config.msgId = msg.id;

      return i.reply({ content: "OK", ephemeral: true });
    }
  }

  // 🔘 BOTÕES
  if (i.isButton()) {

    const id = i.user.id;

    if (i.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });
      return i.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (i.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return i.reply({ content: "❌ Não iniciou", ephemeral: true });

      ranking.set(id, (ranking.get(id) || 0) + (Date.now() - p.inicio));
      pontos.delete(id);

      return i.reply({ content: "🔴 Finalizado", ephemeral: true });
    }
  }
});

client.login(TOKEN);

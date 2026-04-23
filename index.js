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

// 👮 CARGOS
const STAFF_ROLE = "1490431614055088128";
const CARGO_SERVICO = "1492553421973356795";

// 📌 CANAIS
const CANAL_EVENTO = "1477683908026961940";

// ⏰ EVENTO
const EVENTO_INICIO = new Date("2026-04-24T19:00:00-03:00").getTime();
const EVENTO_FIM = new Date("2026-04-24T21:00:00-03:00").getTime();

// 📊 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map(); // serviço
const rankingTempo = new Map(); // horas
const rankingEvento = new Map(); // evento

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

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

// 🤖 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FUNÇÕES
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

function eventoAtivo() {
  const agora = Date.now();
  return agora >= EVENTO_INICIO && agora <= EVENTO_FIM;
}

// 👨‍⚕️ LISTA
function listaServico() {
  let list = "";

  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;
    list += `👨‍⚕️ <@${id}> • ${tempoRelativo(tempo)}\n`;
  }

  return list || "Nenhum médico em serviço";
}

// 🏆 RANKINGS
function rankingHoras() {
  return [...rankingTempo.entries()]
    .sort((a,b) => b[1]-a[1])
    .map(([id,t]) => `<@${id}> • ${format(t)}`)
    .join("\n") || "Sem dados";
}

function rankingEventoTop() {
  return [...rankingEvento.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0,3)
    .map(([id,p],i)=>`${["🥇","🥈","🥉"][i]} <@${id}> — ${p} pts`)
    .join("\n") || "Sem dados";
}

// 🔘 BOTÕES
function botoesPonto() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
  );
}

function botoesEvento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("hacking").setLabel("💻 Hacking").setStyle(ButtonStyle.Secondary)
  );
}

// 📢 PAINEL BATE PONTO (ORIGINAL COMPLETO)
async function updatePanel() {
  if (!config.painel || !config.msgId) return;

  const channel = await client.channels.fetch(config.painel);
  const msg = await channel.messages.fetch(config.msgId);

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

✨ SISTEMA DE PLANTÃO EM FUNCIONAMENTO

👑 RESPONSÁVEL DO PLANTÃO
${getBossList(channel.guild)}

────────────────────────────

👨‍⚕️ EQUIPE EM SERVIÇO
${listaServico()}

────────────────────────────

📊 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

────────────────────────────

🏆 RANKING DE HORAS
${rankingHoras()}
`);

  await msg.edit({ embeds: [embed], components: [botoesPonto()] });
}

// 📢 PAINEL EVENTO
let msgEvento;

async function painelEvento() {
  const canal = await client.channels.fetch(CANAL_EVENTO);

  const embed = new EmbedBuilder()
    .setColor(eventoAtivo() ? "#00ff00" : "#ff0000")
    .setTitle("📢 EVENTO HOSPITAL BELLA")
    .setDescription(`
${eventoAtivo() ? "🟢 ABERTO" : "🔴 FECHADO"}

👨‍⚕️ EM SERVIÇO
${listaServico()}

🏆 TOP 3
${rankingEventoTop()}
`);

  if (msgEvento) {
    const m = await canal.messages.fetch(msgEvento);
    await m.edit({ embeds: [embed], components: [botoesEvento()] });
  } else {
    const m = await canal.send({ embeds: [embed], components: [botoesEvento()] });
    msgEvento = m.id;
  }
}

// 🔁 LOOP
setInterval(() => {
  updatePanel();
  painelEvento();
}, 5000);

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {

  if (i.isButton()) {
    const id = i.user.id;

    // 🔵 PONTO
    if (i.customId === "iniciar") {
      if (pontos.has(id))
        return i.reply({ content: "Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      return i.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (i.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p) return i.reply({ content: "Não iniciou", ephemeral: true });

      const tempo = Date.now() - p.inicio;
      rankingTempo.set(id, (rankingTempo.get(id) || 0) + tempo);
      pontos.delete(id);

      return i.reply({ content: `🔴 Finalizado (${format(tempo)})`, ephemeral: true });
    }

    // 🔴 EVENTO
    if (!eventoAtivo())
      return i.reply({ content: "Evento fechado", ephemeral: true });

    if (!pontos.has(id))
      return i.reply({ content: "Bata ponto primeiro", ephemeral: true });

    if (i.customId === "atendimento") {
      rankingEvento.set(id, (rankingEvento.get(id) || 0) + 1);
      return i.reply({ content: "+1 ponto", ephemeral: true });
    }

    if (i.customId === "chamado") {
      rankingEvento.set(id, (rankingEvento.get(id) || 0) + 1);
      return i.reply({ content: "+1 ponto", ephemeral: true });
    }

    if (i.customId === "hacking") {
      rankingEvento.set(id, (rankingEvento.get(id) || 0) + 2);
      return i.reply({ content: "+2 pontos", ephemeral: true });
    }
  }
});

// 🚀 READY
client.once("ready", async () => {
  console.log("✅ Bot online");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [] }
  );
});

client.login(TOKEN);

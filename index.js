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

// 🏆 TOP 3
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 📌 CANAIS
const CANAL_EVENTO = "1477683908026961940";

// ⏰ EVENTO
const EVENTO_INICIO = new Date("2026-04-24T19:00:00-03:00").getTime();
const EVENTO_FIM = new Date("2026-04-24T21:00:00-03:00").getTime();

// 🧠 SISTEMA ORIGINAL
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🆕 EVENTO
const rankingEvento = new Map();
let eventoFinalizado = false;

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

// 🤖 CLIENT
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
  return `há ${m} minutos`;
}

function eventoAtivo() {
  const agora = Date.now();
  return agora >= EVENTO_INICIO && agora <= EVENTO_FIM;
}

// 👨‍⚕️ LISTA SERVIÇO
function listaServico() {
  let list = "";

  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;
    list += `👨‍⚕️ <@${id}> • ${tempoRelativo(tempo)}\n`;
  }

  return list || "Nenhum médico em serviço";
}

// 🏆 RANKS
function rankingHoras() {
  return [...ranking.entries()]
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
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary)
  );
}

// 📢 PAINEL BATE PONTO
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

// 📢 EVENTO
let msgEvento;

async function painelEvento() {
  const canal = await client.channels.fetch(CANAL_EVENTO);

  const embed = new EmbedBuilder()
    .setColor(eventoAtivo() ? "#00ff00" : "#ff0000")
    .setTitle("📢 EVENTO HOSPITAL BELLA")
    .setDescription(`
${eventoAtivo() ? "🟢 EVENTO ABERTO" : "🔴 EVENTO FECHADO (19:00)"}

👨‍⚕️ EM SERVIÇO
${listaServico()}

━━━━━━━━━━━━━━━━━━

🏆 TOP 3
${rankingEventoTop()}

━━━━━━━━━━━━━━━━━━

🏥 Atendimento → +1  
📞 Chamado → +1
`);

  if (msgEvento) {
    const m = await canal.messages.fetch(msgEvento);
    await m.edit({ embeds: [embed], components: [botoesEvento()] });
  } else {
    const m = await canal.send({ embeds: [embed], components: [botoesEvento()] });
    msgEvento = m.id;
  }
}

// 🏁 FINAL
async function finalizarEvento() {
  if (eventoFinalizado) return;
  eventoFinalizado = true;

  const guild = client.guilds.cache.first();

  const top = [...rankingEvento.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0,3);

  for (let i = 0; i < top.length; i++) {
    const [id] = top[i];
    const member = await guild.members.fetch(id).catch(() => null);
    if (!member) continue;

    const cargo = i === 0 ? CARGO_1 : i === 1 ? CARGO_2 : CARGO_3;
    await member.roles.add(cargo).catch(() => {});
  }

  const canal = await client.channels.fetch(CANAL_EVENTO);

  let resultado = "";
  top.forEach(([id,p],i)=>{
    resultado += `${["🥇","🥈","🥉"][i]} <@${id}> — ${p} pts\n`;
  });

  canal.send({
    embeds: [
      new EmbedBuilder()
        .setColor("#ffd700")
        .setTitle("🏆 RESULTADO FINAL")
        .setDescription(resultado)
    ]
  });
}

// 🔁 LOOP
setInterval(() => {
  updatePanel();
  painelEvento();

  if (Date.now() > EVENTO_FIM) {
    finalizarEvento();
  }

}, 5000);

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const id = i.user.id;

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
    ranking.set(id, (ranking.get(id) || 0) + tempo);
    pontos.delete(id);

    return i.reply({ content: `🔴 Finalizado (${format(tempo)})`, ephemeral: true });
  }

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
});

// 🚀 READY
client.once("ready", () => {
  console.log("✅ Bot online");
});

client.login(TOKEN);

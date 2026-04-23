import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

const TOKEN = process.env.TOKEN;

// 👮 CARGOS
const CARGO_SERVICO_ID = "1492553421973356795";
const CARGO_PING = "1477683902079303932";

// 🏆 TOP 3 CARGOS
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 📌 CANAIS
const CANAL_EVENTO_ID = "1477683908026961940";
const CANAL_BATE_PONTO_ID = "1490431346298851490";

// ⏰ EVENTO (24/04 DAS 19h ÀS 21h)
const EVENTO_INICIO = new Date("2026-04-24T19:00:00-03:00").getTime();
const EVENTO_FIM = new Date("2026-04-24T21:00:00-03:00").getTime();

// 📊 DB
const db = {
  users: {},
  servico: new Set()
};

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = { pontos: 0 };
  }
  return db.users[id];
}

// ⏰ STATUS
function eventoAtivo() {
  const agora = Date.now();
  return agora >= EVENTO_INICIO && agora <= EVENTO_FIM;
}

// 👨‍⚕️ SERVIÇO
function listaServico() {
  if (db.servico.size === 0) return "Nenhum médico em serviço";

  return [...db.servico]
    .map(id => `👨‍⚕️ <@${id}>`)
    .join("\n");
}

// 🏆 RANKING
function ranking() {
  const r = Object.entries(db.users)
    .sort((a, b) => b[1].pontos - a[1].pontos)
    .slice(0, 3);

  if (!r.length) return "Sem dados";

  return r.map(([id, d], i) =>
    `${["🥇","🥈","🥉"][i]} <@${id}> — ${d.pontos} pts`
  ).join("\n");
}

// 🤖 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let msgEventoId;
let msgPontoId;
let eventoFinalizado = false;

// 🔘 BOTÕES EVENTO
function botoesEvento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary)
  );
}

// 🔘 BOTÕES PONTO
function botoesPonto() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("entrar").setLabel("🟢 Entrar em Serviço").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("sair").setLabel("🔴 Sair de Serviço").setStyle(ButtonStyle.Danger)
  );
}

// 📢 PAINEL EVENTO
async function painelEvento() {
  const canal = await client.channels.fetch(CANAL_EVENTO_ID);
  const ativo = eventoAtivo();

  const embed = new EmbedBuilder()
    .setColor(ativo ? "#00ff00" : "#ff0000")
    .setTitle("📢 EVENTO HOSPITAL BELLA")
    .setDescription(
`<@&${CARGO_PING}>

🏥 EVENTO HP — HOSPITAL BELLA
📅 24/04/2026
⏰ 19:00 → 21:00

━━━━━━━━━━━━━━━━━━
${ativo ? "🟢 EVENTO ABERTO" : "🔴 EVENTO FECHADO (LIBERA ÀS 19:00)"}

━━━━━━━━━━━━━━━━━━

👨‍⚕️ EM SERVIÇO
${listaServico()}

━━━━━━━━━━━━━━━━━━

🏆 RANKING AO VIVO
${ranking()}

━━━━━━━━━━━━━━━━━━

🥇 100 mil
🥈 50 mil
🥉 35 mil`
    );

  if (msgEventoId) {
    const msg = await canal.messages.fetch(msgEventoId);
    await msg.edit({ embeds: [embed], components: [botoesEvento()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [botoesEvento()] });
    msgEventoId = msg.id;
  }
}

// 📢 PAINEL BATE PONTO
async function painelPonto() {
  const canal = await client.channels.fetch(CANAL_BATE_PONTO_ID);
  const ativo = eventoAtivo();

  const embed = new EmbedBuilder()
    .setColor(ativo ? "#00ff00" : "#ff0000")
    .setTitle("🕒 BATE PONTO — HOSPITAL BELLA")
    .setDescription(
`🏥 Sistema de entrada em serviço

${ativo 
? "🟢 EVENTO ABERTO — Pode bater ponto" 
: "🔴 EVENTO FECHADO (LIBERA ÀS 19:00)"}

━━━━━━━━━━━━━━━━━━

👨‍⚕️ EM SERVIÇO
${listaServico()}

━━━━━━━━━━━━━━━━━━

⚠️ Bata ponto antes de atender pacientes`
    );

  if (msgPontoId) {
    const msg = await canal.messages.fetch(msgPontoId);
    await msg.edit({ embeds: [embed], components: [botoesPonto()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [botoesPonto()] });
    msgPontoId = msg.id;
  }
}

// 🏁 FINALIZAR EVENTO (TOP 3)
async function finalizarEvento() {
  if (eventoFinalizado) return;
  eventoFinalizado = true;

  const guild = client.guilds.cache.first();

  const rankingFinal = Object.entries(db.users)
    .sort((a, b) => b[1].pontos - a[1].pontos)
    .slice(0, 3);

  for (let i = 0; i < rankingFinal.length; i++) {
    const [userId] = rankingFinal[i];

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;

    const cargo = i === 0 ? CARGO_1 : i === 1 ? CARGO_2 : CARGO_3;

    await member.roles.add(cargo).catch(() => {});
  }

  console.log("🏆 TOP 3 receberam cargos!");
}

// 🔁 LOOP 3s
setInterval(async () => {
  await painelEvento();
  await painelPonto();

  if (Date.now() >= EVENTO_FIM) {
    await finalizarEvento();
  }

}, 3000);

// 🎮 INTERAÇÃO
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const member = await i.guild.members.fetch(i.user.id);

  if (!member.roles.cache.has(CARGO_SERVICO_ID))
    return i.reply({ content: "🚫 Sem cargo", ephemeral: true });

  const user = getUser(i.user.id);

  // 🟢 ENTRAR
  if (i.customId === "entrar") {
    db.servico.add(i.user.id);
    await painelPonto();
    await painelEvento();
    return i.reply({ content: "🟢 Você entrou em serviço", ephemeral: true });
  }

  // 🔴 SAIR
  if (i.customId === "sair") {
    db.servico.delete(i.user.id);
    await painelPonto();
    await painelEvento();
    return i.reply({ content: "🔴 Você saiu de serviço", ephemeral: true });
  }

  if (!eventoAtivo())
    return i.reply({ content: "⛔ Evento fechado", ephemeral: true });

  if (!db.servico.has(i.user.id))
    return i.reply({ content: "⚠️ Bata ponto antes!", ephemeral: true });

  // 🏥 ATENDIMENTO
  if (i.customId === "atendimento") {
    user.pontos += 1;
    await painelEvento();
    return i.reply({ content: "+1 ponto", ephemeral: true });
  }

  // 📞 CHAMADO
  if (i.customId === "chamado") {
    user.pontos += 2;
    await painelEvento();
    return i.reply({ content: "+2 pontos", ephemeral: true });
  }
});

// 🚀 READY
client.once("ready", async () => {
  console.log("✅ Bot online");
  await painelEvento();
  await painelPonto();
});

client.login(TOKEN);

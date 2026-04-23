import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// 🔐 CONFIG
const TOKEN = process.env.TOKEN;

// 👮 CARGOS
const CARGO_SERVICO_ID = "1492553421973356795";
const CARGO_PING = "1477683902079303932";

// 🏆 CARGOS TOP 3
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 📌 CANAIS
const CANAL_PAINEL_ID = "1477683908026961940";
const CANAL_LOGS_ID = "1495370353193521182";

// ⏰ EVENTO (18:00 → 20:00)
const EVENTO_INICIO = new Date("2026-04-19T18:00:00-03:00");
const EVENTO_FIM = new Date("2026-04-19T20:00:00-03:00");

// 📊 DB
const db = { users: {} };

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = { atendimentos: 0, chamados: 0, pontos: 0 };
  }
  return db.users[id];
}

// ⏰ STATUS
function eventoAtivo() {
  const agora = Date.now();
  return agora >= EVENTO_INICIO.getTime() && agora <= EVENTO_FIM.getTime();
}

// 🚫 COOLDOWN 5s
const cooldown = new Map();
const COOLDOWN_TIME = 5000;

function podeClicar(id) {
  const agora = Date.now();
  const ultimo = cooldown.get(id);

  if (ultimo && agora - ultimo < COOLDOWN_TIME) return false;

  cooldown.set(id, agora);
  return true;
}

// 🤖 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let painelMsgId = null;
let finalizado = false;

// 🔘 BOTÕES
function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ranking").setLabel("🏆 Ranking").setStyle(ButtonStyle.Danger)
  );
}

// 📊 LOG NORMAL
async function logEvento(userId, tipo, pontos) {
  try {
    const canal = await client.channels.fetch(CANAL_LOGS_ID);

    const embed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("📊 LOG HOSPITAL BELLA")
      .setDescription(
`👤 Usuário: <@${userId}>
📌 Ação: ${tipo}
⭐ Pontos: +${pontos}
⏰ ${new Date().toLocaleTimeString("pt-BR")}`
      );

    canal.send({ embeds: [embed] });
  } catch {}
}

// 🏆 LOG FINAL TOP 3
async function logTop3Final() {
  try {
    const canal = await client.channels.fetch(CANAL_LOGS_ID);

    const ranking = Object.entries(db.users)
      .sort((a, b) => b[1].pontos - a[1].pontos)
      .slice(0, 3);

    let text = "";

    ranking.forEach(([id, d], i) => {
      const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      text += `${medalha} <@${id}> — ${d.pontos} pts\n`;
    });

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOP 3 FINAL DO EVENTO")
      .setDescription(
`📢 EVENTO ENCERRADO

${text || "Sem dados"}

━━━━━━━━━━━━━━━
🏥 Hospital Bella`
      );

    canal.send({ embeds: [embed] });

  } catch {}
}

// 🏆 RANKING
function gerarRanking() {
  const ranking = Object.entries(db.users)
    .sort((a, b) => b[1].pontos - a[1].pontos)
    .slice(0, 3);

  let text = "";

  ranking.forEach(([id, d], i) => {
    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
    text += `${medalha} **${i + 1}º Lugar**\n👤 <@${id}>\n⭐ ${d.pontos} pts\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#ffd700")
    .setTitle("🏆 RANKING HOSPITAL BELLA")
    .setDescription(text || "Sem dados ainda");
}

// 📢 PAINEL
async function atualizarPainel() {
  const canal = await client.channels.fetch(CANAL_PAINEL_ID);

  const embed = new EmbedBuilder()
    .setColor(eventoAtivo() ? "#00ff00" : "#ff0000")
    .setTitle("📢 EVENTO HOSPITAL BELLA")
    .setDescription(
`<@&${CARGO_PING}>

🏥 **EVENTO HP — HOSPITAL BELLA**

📢 Sistema oficial de atendimentos e chamados em operação

📅 Data: 19/04/2026  
⏰ Horário: 18:00 → 20:00  

━━━━━━━━━━━━━━━━━━

🚑 **DESCRIÇÃO DO EVENTO**
O Hospital Bella está em operação ativa para simulação de atendimentos médicos em tempo real.

Durante o evento, os participantes serão avaliados por:
• Atendimentos realizados  
• Chamados atendidos  
• Tempo de resposta  
• Eficiência geral no serviço  

━━━━━━━━━━━━━━━━━━

${eventoAtivo() ? "🟢 EVENTO ATIVO - SISTEMA EM OPERAÇÃO" : "🔴 EVENTO FECHADO - AGUARDANDO INÍCIO"}

👥 Participantes: ${Object.keys(db.users).length}

━━━━━━━━━━━━━━━━━━

🏆 **PREMIAÇÃO FINAL (20:00)**
🥇 TOP 1 → 100 mil 💰  
🥈 TOP 2 → 50 mil 💰  
🥉 TOP 3 → 35 mil 💰  

━━━━━━━━━━━━━━━━━━

💙 Hospital Bella — excelência em cada atendimento`
    );

  if (painelMsgId) {
    const msg = await canal.messages.fetch(painelMsgId);
    await msg.edit({ embeds: [embed], components: [botoes()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [botoes()] });
    painelMsgId = msg.id;
  }
}

// 🏁 FINAL DO EVENTO
async function finalizarEvento() {
  if (finalizado) return;
  finalizado = true;

  const guild = client.guilds.cache.first();

  const ranking = Object.entries(db.users)
    .sort((a, b) => b[1].pontos - a[1].pontos)
    .slice(0, 3);

  for (let i = 0; i < ranking.length; i++) {
    const [id] = ranking[i];
    const member = await guild.members.fetch(id).catch(() => null);

    if (member) {
      const cargo = i === 0 ? CARGO_1 : i === 1 ? CARGO_2 : CARGO_3;
      await member.roles.add(cargo);
    }
  }

  await logTop3Final();

  console.log("🏆 Evento finalizado com sucesso");
}

// 🔥 LOOP AUTOMÁTICO
let ultimoStatus = null;

setInterval(async () => {
  const agora = Date.now();
  const status = eventoAtivo() ? "aberto" : "fechado";

  if (status !== ultimoStatus) {
    ultimoStatus = status;
    await atualizarPainel();
  }

  if (agora > EVENTO_FIM.getTime()) {
    await finalizarEvento();
  }
}, 5000);

// 🚀 READY
client.once("ready", async () => {
  console.log(`✅ Online: ${client.user.tag}`);
  await atualizarPainel();
});

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const user = getUser(interaction.user.id);

  if (interaction.isButton()) {

    if (!member.roles.cache.has(CARGO_SERVICO_ID))
      return interaction.reply({ content: "🚫 Sem cargo de serviço", ephemeral: true });

    if (!eventoAtivo())
      return interaction.reply({ content: "⛔ Evento fechado", ephemeral: true });

    if (!podeClicar(interaction.user.id))
      return interaction.reply({ content: "⏳ Aguarde 5 segundos!", ephemeral: true });

    if (interaction.customId === "atendimento") {
      user.atendimentos++;
      user.pontos += 1;
      await logEvento(interaction.user.id, "ATENDIMENTO", 1);
      return interaction.reply({ content: "🏥 +1 ponto", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      user.chamados++;
      user.pontos += 2;
      await logEvento(interaction.user.id, "CHAMADO", 2);
      return interaction.reply({ content: "📞 +2 pontos", ephemeral: true });
    }

    if (interaction.customId === "ranking") {
      return interaction.reply({
        embeds: [gerarRanking()],
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);

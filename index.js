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

// 📌 CANAL
const CANAL_PAINEL_ID = "1477683908026961940";

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

// 👨‍⚕️ LISTA SERVIÇO
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

let painelMsgId;

// 🔘 BOTÕES
function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("entrar").setLabel("🟢 Entrar Serviço").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("sair").setLabel("🔴 Sair Serviço").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary)
  );
}

// 📢 PAINEL
async function atualizarPainel() {
  const canal = await client.channels.fetch(CANAL_PAINEL_ID);

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

  if (painelMsgId) {
    const msg = await canal.messages.fetch(painelMsgId);
    await msg.edit({ embeds: [embed], components: [botoes()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [botoes()] });
    painelMsgId = msg.id;
  }
}

// 🔁 ATUALIZA A CADA 3s
setInterval(atualizarPainel, 3000);

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
    await atualizarPainel();
    return i.reply({ content: "🟢 Você entrou em serviço", ephemeral: true });
  }

  // 🔴 SAIR
  if (i.customId === "sair") {
    db.servico.delete(i.user.id);
    await atualizarPainel();
    return i.reply({ content: "🔴 Você saiu de serviço", ephemeral: true });
  }

  if (!eventoAtivo())
    return i.reply({ content: "⛔ Evento fechado", ephemeral: true });

  // 🏥 ATENDIMENTO
  if (i.customId === "atendimento") {
    if (!db.servico.has(i.user.id))
      return i.reply({ content: "⚠️ Você precisa bater ponto!", ephemeral: true });

    user.pontos += 1;
    await atualizarPainel();
    return i.reply({ content: "+1 ponto", ephemeral: true });
  }

  // 📞 CHAMADO
  if (i.customId === "chamado") {
    if (!db.servico.has(i.user.id))
      return i.reply({ content: "⚠️ Você precisa bater ponto!", ephemeral: true });

    user.pontos += 2;
    await atualizarPainel();
    return i.reply({ content: "+2 pontos", ephemeral: true });
  }
});

// 🚀 READY
client.once("ready", async () => {
  console.log("✅ Bot online");
  atualizarPainel();
});

client.login(TOKEN);

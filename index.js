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

// 🔐 CONFIG
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// 📌 CANAIS
const CANAL_EVENTO = "1477683908026961940";

// 🛡️ STAFF
const STAFF_ROLE = "1490431614055088128";

// 🏆 CARGOS TOP 3
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 🧠 HP (ORIGINAL)
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 📊 EVENTO
const rankingEvento = new Map();
let msgEventoId = null;

// 🚀 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ UTIL
function tempo(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "há poucos segundos" : `há ${m} min`;
}

// 👑 HIERARQUIA HP (NÃO MEXIDA)
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

    const member = role.members.find(m => !usados.has(m.id));
    if (!member) return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 HP BOTÕES
function rowHP() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
  );
}

// 🔘 EVENTO BOTÕES
function rowEvento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary)
  );
}

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [] }
  );

  setInterval(updateHP, 15000);
  setInterval(updateEvento, 3000);
});

// 🏥 HP (ORIGINAL)
async function updateHP() {
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
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

👑 HIERARQUIA
${getBossList(channel.guild)}

────────────────────────────

👨‍⚕️ EM SERVIÇO
${list}

────────────────────────────
📊 Médicos ativos: ${pontos.size}
🕒 Atualização: automática
`);

    await msg.edit({ embeds: [embed], components: [rowHP()] });

  } catch {}
}

// 📢 EVENTO
async function updateEvento() {
  try {
    const canal = await client.channels.fetch(CANAL_EVENTO);

    let top = [...rankingEvento.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3);

    const lista = top.length
      ? top.map(([id,p],i)=>`${["🥇","🥈","🥉"][i]} <@${id}> — ${p} pts`).join("\n")
      : "Sem dados";

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setDescription(`
📢 ═════════════〔 EVENTO HOSPITAL BELLA 〕═════════════

🏆 TOP 3
${lista}

────────────────────────────
🕒 Atualização: 3s
`);

    if (msgEventoId) {
      const msg = await canal.messages.fetch(msgEventoId);
      await msg.edit({ embeds: [embed], components: [rowEvento()] });
    } else {
      const msg = await canal.send({ embeds: [embed], components: [rowEvento()] });
      msgEventoId = msg.id;
    }

  } catch {}
}

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {
  const id = i.user.id;

  if (i.isButton()) {

    // 🏥 HP
    if (i.customId === "iniciar") {
      if (pontos.has(id))
        return i.reply({ content: "Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      return i.reply({ content: "🟢 Iniciado", ephemeral: true });
    }

    if (i.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p)
        return i.reply({ content: "Não iniciou", ephemeral: true });

      ranking.set(id, (ranking.get(id)||0)+(Date.now()-p.inicio));
      pontos.delete(id);

      return i.reply({ content: "🔴 Finalizado", ephemeral: true });
    }

    // 📢 EVENTO
    rankingEvento.set(id, (rankingEvento.get(id)||0)+1);

    if (i.customId === "atendimento")
      return i.reply({ content: "+1 Atendimento", ephemeral: true });

    if (i.customId === "chamado")
      return i.reply({ content: "+1 Chamado", ephemeral: true });
  }

  // 🧠 COMANDO HP
  if (i.isChatInputCommand()) {

    if (!isStaff(i.member))
      return i.reply({ content: "Sem permissão", ephemeral: true });

    if (i.commandName === "painelhp") {
      const canal = i.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 PAINEL HP ATIVO")],
        components: [rowHP()]
      });

      config.msgId = msg.id;

      return i.reply({ content: "OK", ephemeral: true });
    }
  }
});

client.login(TOKEN);

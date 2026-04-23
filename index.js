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

// 📌 CANAIS
const CANAL_EVENTO = "COLOQUE_ID_EVENTO";

// 🛡️ STAFF
const STAFF_ROLE = "1490431614055088128";

// 🧠 SISTEMAS
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();
const rankingEvento = new Map();

let msgEventoId = null;

// 🏆 CARGOS EVENTO
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 🤖 BOT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ UTIL
function tempo(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "há poucos segundos" : `há ${m} min`;
}

// 👑 HIERARQUIA
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

// 📌 COMMAND
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    )
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updateHP, 3000);
  setInterval(updateEvento, 3000);
});

// 🏥 HP PAINEL
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
🏥 ════════ **HOSPITAL BELLA** ════════

👑 HIERARQUIA
${getBossList(channel.guild)}

────────────────────────────

👨‍⚕️ EM SERVIÇO
${list}

────────────────────────────
📊 Ativos: ${pontos.size}
🕒 Atualização: 3s
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
      .slice(0,3)
      .map(([id,p],i)=>`${["🥇","🥈","🥉"][i]} <@${id}> — ${p} pts`)
      .join("\n");

    if (!top) top = "Sem dados";

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("📢 EVENTO HOSPITAL BELLA")
      .setDescription(`
🏥 EVENTO ATIVO

🏆 TOP 3
${top}

────────────────────────────
📊 Atualização: 3s
`);

    if (!msgEventoId) {
      const msg = await canal.send({ embeds: [embed] });
      msgEventoId = msg.id;
    } else {
      const msg = await canal.messages.fetch(msgEventoId);
      await msg.edit({ embeds: [embed] });
    }

  } catch {}
}

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {
  const id = i.user.id;

  if (i.isButton()) {

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

      ranking.set(id, (ranking.get(id)||0) + (Date.now()-p.inicio));
      pontos.delete(id);

      return i.reply({ content: "🔴 Finalizado", ephemeral: true });
    }

    // EVENTO
    if (i.customId === "atendimento" || i.customId === "chamado") {
      rankingEvento.set(id, (rankingEvento.get(id)||0)+1);
      return i.reply({ content: "+1 ponto evento", ephemeral: true });
    }
  }

  if (i.isChatInputCommand()) {

    if (!isStaff(i.member))
      return i.reply({ content: "Sem permissão", ephemeral: true });

    if (i.commandName === "painelhp") {
      const canal = i.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 PAINEL ATIVO")],
        components: [rowHP()]
      });

      config.msgId = msg.id;

      return i.reply({ content: "OK", ephemeral: true });
    }
  }
});

client.login(TOKEN);

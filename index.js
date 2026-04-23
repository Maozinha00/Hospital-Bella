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

// 📌 CANAIS (OPCIONAL)
const CANAL_EVENTO = "COLOQUE_ID_EVENTO";

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1490431614055088128";

// 🧠 SISTEMAS
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();
const rankingEvento = new Map();
let msgEventoId = null;

// 🏥 CARGOS HP
const CARGO_EM_SERVICO = "1492553421973356795";
const CARGO_FORA_SERVICO = "1492553631642288160";

// 👑 HIERARQUIA (3 DIRETORES CORRIGIDOS)
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509019", nome: "Diretor 2" },
  { id: "1477683902121509020", nome: "Diretor 3" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador 1" },
  { id: "1477683902121509014", nome: "Coordenador 2" }
];

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
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function tempo(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "há poucos segundos" : `há ${m} min`;
}

// 👑 HIERARQUIA DISPLAY (SEM BUG)
function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role) return `👑 Nenhum • ${r.nome}`;

    const member = role.members?.first();

    if (!member || usados.has(member.id))
      return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

// 🔐 PERMISSÃO
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES HP
function rowHP() {
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

// 🔘 BOTÕES EVENTO
function rowEvento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("atendimento")
      .setLabel("🏥 Atendimento")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("chamado")
      .setLabel("📞 Chamado")
      .setStyle(ButtonStyle.Primary)
  );
}

// 📌 COMANDO
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal HP").setRequired(true)
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

// 🏥 PAINEL HP
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

👑 **HIERARQUIA**
${getBossList(channel.guild)}

────────────────────────────

🟢 **EM SERVIÇO**
<@&${CARGO_EM_SERVICO}>

🔴 **FORA DE SERVIÇO**
<@&${CARGO_FORA_SERVICO}>

────────────────────────────

👨‍⚕️ **PLANTÃO**
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
  const canal = await client.channels.fetch(CANAL_EVENTO);

  let top = [...rankingEvento.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
    .map(([id,p],i)=>`${["🥇","🥈","🥉"][i]} <@${id}> — ${p}`)
    .join("\n");

  if (!top) top = "Sem dados";

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("📢 EVENTO HOSPITAL")
    .setDescription(`
🏥 EVENTO ATIVO

🏆 TOP 3
${top}

────────────────────────────
Atualização: 3s
`);

  if (msgEventoId) {
    const msg = await canal.messages.fetch(msgEventoId);
    await msg.edit({ embeds: [embed], components: [rowEvento()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [rowEvento()] });
    msgEventoId = msg.id;
  }
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
        return i.reply({ content: "Não está em serviço", ephemeral: true });

      ranking.set(id, (ranking.get(id)||0) + (Date.now()-p.inicio));
      pontos.delete(id);

      return i.reply({ content: "🔴 Finalizado", ephemeral: true });
    }

    if (!pontos.has(id))
      return i.reply({ content: "Bata ponto primeiro", ephemeral: true });

    if (i.customId === "atendimento") {
      rankingEvento.set(id, (rankingEvento.get(id)||0)+1);
      return i.reply({ content: "+1 Atendimento", ephemeral: true });
    }

    if (i.customId === "chamado") {
      rankingEvento.set(id, (rankingEvento.get(id)||0)+1);
      return i.reply({ content: "+1 Chamado", ephemeral: true });
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

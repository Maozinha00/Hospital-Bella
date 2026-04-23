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

// 🏆 TOP 3 CARGOS
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// 📌 CANAL EVENTO
const CANAL_EVENTO = "1477683908026961940";

// ⏰ EVENTO
const EVENTO_INICIO = new Date("2026-04-24T19:00:00-03:00").getTime();
const EVENTO_FIM = new Date("2026-04-24T21:00:00-03:00").getTime();

// 🧠 SISTEMA ORIGINAL (INALTERADO)
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🆕 EVENTO (SEPARADO)
const rankingEvento = new Map();
let eventoFinalizado = false;
let msgEventoId = null;

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FORMAT
function format(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function tempoRelativo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "há poucos segundos";
  if (m === 1) return "há um minuto";
  return `há ${m} minutos`;
}

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

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES ORIGINAIS
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
  );
}

// 🔘 BOTÕES EVENTO
function botoesEvento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary)
  );
}

// 📌 COMMANDS (ORIGINAL)
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder().setName("addhora").setDescription("Adicionar tempo")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("horas"))
    .addIntegerOption(o => o.setName("minutos")),

  new SlashCommandBuilder().setName("removerhora").setDescription("Remover tempo")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("horas"))
    .addIntegerOption(o => o.setName("minutos")),

  new SlashCommandBuilder().setName("rankinghp").setDescription("Ranking"),

  new SlashCommandBuilder().setName("forcar_entrar")
    .addUserOption(o => o.setName("usuario").setRequired(true)),

  new SlashCommandBuilder().setName("forcar_sair")
    .addUserOption(o => o.setName("usuario").setRequired(true))

].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 15000);
  setInterval(painelEvento, 5000);
});

// 🏥 PAINEL ORIGINAL (SEM ALTERAÇÃO)
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";
    for (const [id, data] of pontos) {
      const time = Date.now() - data.inicio;
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

** ✨ SISTEMA DE PLANTÃO EM FUNCIONAMENTO **

** 👑 RESPONSÁVEL DO PLANTÃO **
${getBossList(channel.guild)}

────────────────────────────

** 👨‍⚕️ EQUIPE EM SERVIÇO **
${list}

────────────────────────────

📊 STATUS
👥 Médicos ativos: ${pontos.size}
🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch {}
}

// 📢 EVENTO (SEPARADO)
async function painelEvento() {
  const canal = await client.channels.fetch(CANAL_EVENTO);

  const top = [...rankingEvento.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
    .map(([id,p],i)=>`${["🥇","🥈","🥉"][i]} <@${id}> — ${p} pts`)
    .join("\n") || "Sem dados";

  const embed = new EmbedBuilder()
    .setColor(Date.now() >= EVENTO_INICIO ? "#00ff00" : "#ff0000")
    .setTitle("📢 EVENTO HOSPITAL BELLA")
    .setDescription(`
${Date.now() >= EVENTO_INICIO ? "🟢 EVENTO ABERTO" : "🔴 EVENTO FECHADO"}

🏆 TOP 3
${top}
`);

  if (msgEventoId) {
    const msg = await canal.messages.fetch(msgEventoId);
    await msg.edit({ embeds: [embed], components: [botoesEvento()] });
  } else {
    const msg = await canal.send({ embeds: [embed], components: [botoesEvento()] });
    msgEventoId = msg.id;
  }

  if (Date.now() > EVENTO_FIM) finalizarEvento();
}

// 🏁 FINAL EVENTO
async function finalizarEvento() {
  if (eventoFinalizado) return;
  eventoFinalizado = true;

  const guild = client.guilds.cache.first();

  const top = [...rankingEvento.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3);

  for (let i = 0; i < top.length; i++) {
    const [id] = top[i];
    const member = await guild.members.fetch(id).catch(()=>null);
    if (!member) continue;

    const cargo = i===0?CARGO_1:i===1?CARGO_2:CARGO_3;
    await member.roles.add(cargo).catch(()=>{});
  }
}

// 🎮 INTERAÇÕES (ORIGINAL + EVENTO)
client.on("interactionCreate", async (interaction) => {

  // ===== ORIGINAL (NÃO MEXI) =====
  if (interaction.isChatInputCommand()) {
    const member = interaction.member;
    if (!isStaff(member))
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });

    const user = interaction.options.getUser("usuario");
    const h = interaction.options.getInteger("horas") || 0;
    const m = interaction.options.getInteger("minutos") || 0;
    const tempo = (h * 3600000) + (m * 60000);

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;
      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 Painel ativo")],
        components: [row()]
      });

      config.msgId = msg.id;
      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "addhora") {
      ranking.set(user.id, (ranking.get(user.id) || 0) + tempo);
      return interaction.reply({ content: "✅ Adicionado!", ephemeral: true });
    }

    if (interaction.commandName === "removerhora") {
      ranking.set(user.id, Math.max(0, (ranking.get(user.id) || 0) - tempo));
      return interaction.reply({ content: "❌ Removido!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a,b)=>b[1]-a[1])
        .map(([id,t])=>`<@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(top || "Sem dados")]
      });
    }

    if (interaction.commandName === "forcar_entrar") {
      pontos.set(user.id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Colocado em serviço", ephemeral: true });
    }

    if (interaction.commandName === "forcar_sair") {
      const p = pontos.get(user.id);
      if (!p) return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });

      const time = Date.now() - p.inicio;
      ranking.set(user.id, (ranking.get(user.id) || 0) + time);
      pontos.delete(user.id);

      return interaction.reply({ content: `🔴 Removido • ${format(time)}`, ephemeral: true });
    }
  }

  // ===== BOTÕES =====
  if (interaction.isButton()) {
    const id = interaction.user.id;

    // PONTO (ORIGINAL)
    if (interaction.customId === "iniciar") {
      if (pontos.has(id))
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p)
        return interaction.reply({ content: "❌ Não iniciou", ephemeral: true });

      const time = Date.now() - p.inicio;
      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      return interaction.reply({ content: `🔴 Finalizado • ${format(time)}`, ephemeral: true });
    }

    // EVENTO
    if (Date.now() < EVENTO_INICIO)
      return interaction.reply({ content: "Evento fechado", ephemeral: true });

    if (!pontos.has(id))
      return interaction.reply({ content: "Bata ponto primeiro", ephemeral: true });

    if (interaction.customId === "atendimento") {
      rankingEvento.set(id, (rankingEvento.get(id) || 0) + 1);
      return interaction.reply({ content: "+1 ponto", ephemeral: true });
    }

    if (interaction.customId === "chamado") {
      rankingEvento.set(id, (rankingEvento.get(id) || 0) + 1);
      return interaction.reply({ content: "+1 ponto", ephemeral: true });
    }
  }
});

client.login(TOKEN);

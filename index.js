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

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";
const ROLE_EM_SERVICO = "1492553421973356795";
const ROLE_FORA_SERVICO = "1492553631642288160";

// 🏆 TOP 3
const CARGO_1 = "1477683902100410424";
const CARGO_2 = "1495374426815074304";
const CARGO_3 = "1495374557404594267";

// ⏰ EVENTO
const EVENTO_INICIO = new Date("2026-04-24T19:00:00-03:00");
const EVENTO_FIM = new Date("2026-04-24T21:00:00-03:00");

// 🧠
let config = { painel: null, msgId: null };
const pontos = new Map();
const eventoDB = {};
let eventoFinalizado = false;

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMMAND
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    )
].map(c => c.toJSON());

// ⏱ STATUS EVENTO
function eventoStatus() {
  const now = Date.now();
  if (now < EVENTO_INICIO.getTime()) return "fechado";
  if (now >= EVENTO_INICIO.getTime() && now <= EVENTO_FIM.getTime()) return "ativo";
  return "finalizado";
}

// 📊 USER
function getUser(id) {
  if (!eventoDB[id]) {
    eventoDB[id] = { pontos: 0 };
  }
  return eventoDB[id];
}

// 🏆 TOP 3
function top3() {
  return Object.entries(eventoDB)
    .sort((a, b) => b[1].pontos - a[1].pontos)
    .slice(0, 3);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("atendimento").setLabel("🏥 Atendimento").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("chamado").setLabel("📞 Chamado").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ranking").setLabel("🏆 Ranking").setStyle(ButtonStyle.Danger)
  );
}

// 🏥 UPDATE
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId).catch(() => null);
    if (!msg) return;

    const role = channel.guild.roles.cache.get(ROLE_EM_SERVICO);

    let list = role?.members.size
      ? [...role.members.values()].map(m => `<@${m.id}>`).join("\n")
      : "Nenhum médico em serviço";

    const status = eventoStatus();

    let eventoText = "";
    let rankingText = "";

    if (status === "fechado") {
      eventoText = "🔴 EVENTO FECHADO (ABRE ÀS 19:00)";
    }

    if (status === "ativo") {
      eventoText = "🟢 EVENTO ABERTO (ATENDIMENTOS LIBERADOS)";
    }

    if (status === "finalizado") {
      eventoText = "🏁 EVENTO FINALIZADO";

      rankingText = top3()
        .map((u, i) => `${["🥇","🥈","🥉"][i]} <@${u[0]}> • ${u[1].pontos} pts`)
        .join("\n") || "Sem dados";
    }

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

👨‍⚕️ EM SERVIÇO
${list}

────────────────────────────

${eventoText}

${status === "finalizado" ? `
🏆 RESULTADO FINAL
${rankingText}

🎁 PREMIAÇÃO
🥇 100k
🥈 50k
🥉 35k
` : ""}

────────────────────────────

⏰ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch {}
}

// 🏁 FINAL
async function finalizarEvento() {
  const guild = client.guilds.cache.first();
  const ranking = top3();

  for (let i = 0; i < ranking.length; i++) {
    const member = await guild.members.fetch(ranking[i][0]).catch(() => null);
    if (!member) continue;

    const cargo = i === 0 ? CARGO_1 : i === 1 ? CARGO_2 : CARGO_3;
    await member.roles.add(cargo);
  }
}

// 🔁 LOOP
setInterval(async () => {
  await updatePanel();

  if (eventoStatus() === "finalizado" && !eventoFinalizado) {
    eventoFinalizado = true;
    await finalizarEvento();
  }
}, 5000);

// 🚀 READY
client.once("clientReady", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
});

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "❌ Sem permissão", flags: 64 });
    }

    const canal = interaction.options.getChannel("canal");
    config.painel = canal.id;

    const msg = await canal.send({
      embeds: [new EmbedBuilder().setDescription("🏥 Painel iniciado...")],
      components: [row()]
    });

    config.msgId = msg.id;

    return interaction.reply({ content: "✅ Painel criado!", flags: 64 });
  }

  if (interaction.isButton()) {

    const member = interaction.member;
    const status = eventoStatus();
    const user = getUser(member.id);

    // 🔐 BLOQUEIO
    if (
      ["atendimento","chamado","ranking"].includes(interaction.customId) &&
      (status !== "ativo" || !member.roles.cache.has(ROLE_EM_SERVICO))
    ) {
      return interaction.reply({
        content: "⛔ Evento fechado ou você não está em serviço",
        flags: 64
      });
    }

    if (interaction.customId === "iniciar") {
      await member.roles.add(ROLE_EM_SERVICO);
      await member.roles.remove(ROLE_FORA_SERVICO);
      return interaction.reply({ content: "🟢 Serviço iniciado", flags: 64 });
    }

    if (interaction.customId === "finalizar") {
      await member.roles.remove(ROLE_EM_SERVICO);
      await member.roles.add(ROLE_FORA_SERVICO);
      return interaction.reply({ content: "🔴 Serviço finalizado", flags: 64 });
    }

    if (interaction.customId === "atendimento") {
      user.pontos += 1;
      return interaction.reply({ content: "🏥 +1 ponto", flags: 64 });
    }

    if (interaction.customId === "chamado") {
      user.pontos += 2;
      return interaction.reply({ content: "📞 +2 pontos", flags: 64 });
    }

    if (interaction.customId === "ranking") {
      return interaction.reply({
        content: "📊 Ranking disponível apenas após o evento",
        flags: 64
      });
    }
  }
});

client.login(TOKEN);

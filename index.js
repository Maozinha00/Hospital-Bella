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

import express from "express";

// 🌐 KEEP ONLINE
const app = express();
app.get("/", (req, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 TOKEN
const TOKEN = process.env.TOKEN;
if (!TOKEN) process.exit(1);

// ⚙️ CONFIG
const TEMPO_MAXIMO = 7 * 60 * 60 * 1000; // 7h
const CARGO_ADV = "1477683902041690350";

// 🧠 SISTEMA
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true))
    .addChannelOption(o =>
      o.setName("logs").setDescription("Canal de logs").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking de plantão")
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} online`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  setInterval(() => atualizarPainel().catch(() => {}), 30000);
  setInterval(() => verificarTempo().catch(() => {}), 60000);
});

// 💎 LOG
async function sendLog(embed) {
  try {
    if (!config.logs) return;

    const canal = await client.channels.fetch(config.logs).catch(() => null);
    if (!canal || !canal.isTextBased()) return;

    canal.send({ embeds: [embed] });
  } catch {}
}

// 🧠 FORMATAR TEMPO
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🧠 PAINEL BONITO
async function atualizarPainel() {
  try {
    if (!config.painel || !config.msgId) return;

    const canal = await client.channels.fetch(config.painel).catch(() => null);
    if (!canal) return;

    const msg = await canal.messages.fetch(config.msgId).catch(() => null);
    if (!msg) return;

    let lista = "";
    let chefe = null;
    let maiorTempo = 0;

    for (const [id, data] of pontos) {
      const tempo = Date.now() - data.inicio;

      if (tempo > maiorTempo) {
        maiorTempo = tempo;
        chefe = id;
      }
    }

    if (pontos.size === 0) {
      lista = "- Nenhum médico em serviço";
    } else {
      for (const [id, data] of pontos) {
        const tempo = Date.now() - data.inicio;
        lista += `┆ 👨‍⚕️ <@${id}> • ${formatar(tempo)}\n`;
      }
    }

    let chefeInfo = "Nenhum";
    if (chefe) {
      chefeInfo = `<@${chefe}> • ${formatar(maiorTempo)}`;
    }

    let status = "🔴 CRÍTICO";
    if (pontos.size >= 3) status = "🟢 NORMAL";
    else if (pontos.size >= 1) status = "🟡 BAIXO EFETIVO";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(
`🏥 ═══════〔 HOSPITAL BELLA 〕═══════
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏥 Sistema Hospitalar Ativo
╰━━━━━━━━━━━━━━━━━━━━╯

👑 RESPONSÁVEL DO PLANTÃO
${chefeInfo}

👨‍⚕️ MÉDICOS EM SERVIÇO
${lista}

📊 STATUS
┆ 👥 Ativos: ${pontos.size}
┆ 🕒 Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

🚨 SITUAÇÃO
┆ ${status}

Hospital Bella • Sistema de Ponto`
      )
      .setTimestamp();

    await msg.edit({ embeds: [embed] });

  } catch {}
}

// 🚨 ADVERTÊNCIA
async function verificarTempo() {
  for (const [id, data] of pontos) {

    const tempo = Date.now() - data.inicio;

    if (tempo >= TEMPO_MAXIMO) {

      const guild = client.guilds.cache.first();
      if (!guild) continue;

      const membro = await guild.members.fetch(id).catch(() => null);
      if (!membro) continue;

      await membro.roles.add(CARGO_ADV).catch(() => {});

      pontos.delete(id);
      atualizarPainel();

      sendLog(new EmbedBuilder()
        .setColor("#dc2626")
        .setTitle("🚨 ADVERTÊNCIA AUTOMÁTICA")
        .setDescription(`<@${id}> passou de 7h em serviço`)
      );
    }
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  try {

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "painelhp") {

        config.painel = interaction.options.getChannel("canal").id;
        config.logs = interaction.options.getChannel("logs").id;

        const embed = new EmbedBuilder()
          .setTitle("🏥 Controle de Plantão")
          .setDescription("Use os botões abaixo");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("iniciar").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("finalizar").setLabel("🔴 Finalizar").setStyle(ButtonStyle.Danger)
        );

        const canal = await client.channels.fetch(config.painel);
        const msg = await canal.send({ embeds: [embed], components: [row] });

        config.msgId = msg.id;

        return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
      }

      if (interaction.commandName === "rankinghp") {

        if (ranking.size === 0)
          return interaction.reply("❌ Sem dados");

        let lista = "";

        const ordenado = [...ranking.entries()].sort((a, b) => b[1] - a[1]);

        for (const [id, tempo] of ordenado) {
          lista += `<@${id}> • ${formatar(tempo)}\n`;
        }

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle("🏆 Ranking").setDescription(lista)]
        });
      }
    }

    if (interaction.isButton()) {

      const id = interaction.user.id;

      if (interaction.customId === "iniciar") {

        pontos.set(id, { inicio: Date.now() });
        atualizarPainel();

        sendLog(new EmbedBuilder()
          .setColor("#22c55e")
          .setDescription(`<@${id}> iniciou serviço`)
        );

        return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
      }

      if (interaction.customId === "finalizar") {

        const ponto = pontos.get(id);
        if (!ponto)
          return interaction.reply({ content: "❌ Você não iniciou!", ephemeral: true });

        const tempo = Date.now() - ponto.inicio;

        ranking.set(id, (ranking.get(id) || 0) + tempo);
        pontos.delete(id);

        atualizarPainel();

        sendLog(new EmbedBuilder()
          .setColor("#ef4444")
          .setDescription(`<@${id}> finalizou • ${formatar(tempo)}`)
        );

        return interaction.reply({
          content: `🔴 Finalizado: ${formatar(tempo)}`,
          ephemeral: true
        });
      }
    }

  } catch {}
});

// 🛡️ ANTI-CRASH
process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

client.login(TOKEN);

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

// 🌐 KEEP ALIVE
const app = express();
app.get("/", (_, res) => res.send("Bot online 🔥"));
app.listen(3000);

// 🔐 TOKEN
const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error("TOKEN não definido");

// 🏷️ CONFIG
const GUILD_ID = "1477683902041690342";
const STAFF_ROLE = "1490431614055088128";

const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const CARGO_ADV = "1477683902041690350";

const TEMPO_MAXIMO = 7 * 60 * 60 * 1000;

// 🧠 SISTEMA
let config = { painel: null, logs: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 📌 COMANDOS COMPLETOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("🏥 Criar painel hospital")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal do painel").setRequired(true))
    .addChannelOption(o =>
      o.setName("logs").setDescription("Canal de logs").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("🏆 Ver ranking de plantão"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("🔄 Resetar sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("➕ Adicionar horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos")),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("➖ Remover horas")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption(o =>
      o.setName("horas").setDescription("Horas").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutos").setDescription("Minutos"))
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  setInterval(atualizarPainel, 30000);
});

// ⏱️ FORMATAR
function formatar(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// 🔐 STAFF CHECK
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🏥 PAINEL BONITO
async function atualizarPainel() {
  if (!config.painel || !config.msgId) return;

  const canal = await client.channels.fetch(config.painel).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  let chefe = null;
  let maior = 0;

  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;

    if (tempo > maior) {
      maior = tempo;
      chefe = id;
    }

    lista += `👨‍⚕️ <@${id}> • ${formatar(tempo)}\n`;
  }

  const status =
    pontos.size >= 3 ? "🟢 NORMAL" :
    pontos.size >= 1 ? "🟡 BAIXO" :
    "🔴 CRÍTICO";

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setTitle("🏥 HOSPITAL BELLA")
    .setDescription(
`╭━━━━━━━━━━━━━━━╮
🏥 SISTEMA DE PLANTÃO
╰━━━━━━━━━━━━━━━╯

👑 RESPONSÁVEL DO PLANTÃO
${chefe ? `<@${chefe}> • ${formatar(maior)}` : "Nenhum"}

👨‍⚕️ MÉDICOS EM SERVIÇO
${lista || "Nenhum médico online"}

📊 STATUS
👥 Ativos: ${pontos.size}
🚨 Situação: ${status}
⏱️ Atualizado: <t:${Math.floor(Date.now()/1000)}:R>

💙 Hospital Bella System`
    )
    .setTimestamp();

  await msg.edit({ embeds: [embed] }).catch(() => {});
}

// 🚀 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  try {

    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    const member = interaction.member;

    // 🔐 STAFF ONLY
    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ Apenas STAFF pode usar isso.",
        ephemeral: true
      });
    }

    // =====================
    // 📌 COMANDOS
    // =====================

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "painelhp") {

        config.painel = interaction.options.getChannel("canal").id;
        config.logs = interaction.options.getChannel("logs").id;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("iniciar")
            .setLabel("🟢 Iniciar")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("finalizar")
            .setLabel("🔴 Finalizar")
            .setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏥 Painel Hospital")
              .setDescription("Use os botões abaixo")
          ],
          components: [row]
        });

        config.msgId = msg.id;

        return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
      }

      if (interaction.commandName === "resetponto") {
        pontos.clear();
        ranking.clear();
        return interaction.reply({ content: "🔄 Resetado!", ephemeral: true });
      }

      if (interaction.commandName === "rankinghp") {
        const lista = [...ranking.entries()]
          .sort((a,b)=>b[1]-a[1])
          .map(([id,t])=>`<@${id}> • ${formatar(t)}`)
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 Ranking")
              .setDescription(lista || "Sem dados")
          ]
        });
      }

      if (interaction.commandName === "addhora") {
        const u = interaction.options.getUser("usuario");
        const h = interaction.options.getInteger("horas");
        const m = interaction.options.getInteger("minutos") || 0;

        const ms = (h*60+m)*60000;
        ranking.set(u.id, (ranking.get(u.id)||0)+ms);

        return interaction.reply({ content: "➕ Adicionado", ephemeral: true });
      }

      if (interaction.commandName === "removerhora") {
        const u = interaction.options.getUser("usuario");
        const h = interaction.options.getInteger("horas");
        const m = interaction.options.getInteger("minutos") || 0;

        const ms = (h*60+m)*60000;
        ranking.set(u.id, Math.max(0,(ranking.get(u.id)||0)-ms));

        return interaction.reply({ content: "➖ Removido", ephemeral: true });
      }
    }

    // =====================
    // 🔘 BOTÕES
    // =====================

    if (interaction.isButton()) {

      const id = interaction.user.id;
      const memberBtn = interaction.member;

      let ponto = pontos.get(id);

      if (interaction.customId === "iniciar") {
        pontos.set(id, { inicio: Date.now() });

        await memberBtn.roles.add(CARGO_EM).catch(()=>{});
        await memberBtn.roles.remove(CARGO_FORA).catch(()=>{});

        atualizarPainel();

        return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
      }

      if (interaction.customId === "finalizar") {
        if (!ponto) {
          return interaction.reply({ content: "❌ Não iniciado!", ephemeral: true });
        }

        const tempo = Date.now() - ponto.inicio;

        ranking.set(id, (ranking.get(id)||0)+tempo);
        pontos.delete(id);

        await memberBtn.roles.remove(CARGO_EM).catch(()=>{});
        await memberBtn.roles.add(CARGO_FORA).catch(()=>{});

        atualizarPainel();

        return interaction.reply({
          content: `🔴 Finalizado: ${formatar(tempo)}`,
          ephemeral: true
        });
      }
    }

  } catch (err) {
    console.error(err);
  }
});

// 🚀 LOGIN
client.login(TOKEN);

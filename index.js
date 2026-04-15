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

// 🏷️ IDS
const GUILD_ID = "1477683902041690342";

const CARGO_EM = "1492553421973356795";
const CARGO_FORA = "1492553631642288160";
const CARGO_ADV = "1477683902041690350";

const STAFF_ROLE = "1490431614055088128";

// 👑 HIERARQUIA
const HIERARQUIA = [
  { cargo: "1477683902121509018", nome: "👑 Diretor(a)", peso: 4 },
  { cargo: "1477683902121509017", nome: "🎖️ Vice-Diretor(a)", peso: 3 },
  { cargo: "1477683902121509016", nome: "🔱 Supervisor(a)", peso: 2 },
  { cargo: "1477683902121509015", nome: "🩺 Coordenador(a)", peso: 1 }
];

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
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
      o.setName("canal").setDescription("Canal do painel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Resetar sistema"),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("horas").setRequired(true))
    .addIntegerOption(o => o.setName("minutos")),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addIntegerOption(o => o.setName("horas").setRequired(true))
    .addIntegerOption(o => o.setName("minutos"))
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

// 👑 RESPONSÁVEL POR HIERARQUIA
async function getResponsavel(guild) {
  let melhor = null;
  let pesoMax = 0;

  for (const id of pontos.keys()) {
    const m = await guild.members.fetch(id).catch(() => null);
    if (!m) continue;

    for (const h of HIERARQUIA) {
      if (m.roles.cache.has(h.cargo) && h.peso > pesoMax) {
        pesoMax = h.peso;
        melhor = { id: m.id, nome: h.nome };
      }
    }
  }

  return melhor;
}

// 🏥 PAINEL PREMIUM
async function atualizarPainel() {
  if (!config.painel || !config.msgId) return;

  const canal = await client.channels.fetch(config.painel).catch(() => null);
  if (!canal) return;

  const msg = await canal.messages.fetch(config.msgId).catch(() => null);
  if (!msg) return;

  let lista = "";

  for (const [id, data] of pontos) {
    const tempo = Date.now() - data.inicio;
    lista += `┆ 🟢 <@${id}> • ${formatar(tempo)}\n`;
  }

  const guild = client.guilds.cache.get(GUILD_ID);
  const responsavel = await getResponsavel(guild);

  const embed = new EmbedBuilder()
    .setColor("#0f172a")
    .setDescription(
`🏥 **═══════〔 HOSPITAL BELLA 〕═══════**

👑 **RESPONSÁVEL DO PLANTÃO**
${
responsavel
  ? `╭─ 🏅 ${responsavel.nome}\n╰─ 👤 <@${responsavel.id}>`
  : `╭─ ❌ Nenhum responsável\n╰─ Aguardando equipe`
}

━━━━━━━━━━━━━━━━━━━━

👨‍⚕️ **MÉDICOS EM SERVIÇO**
${lista || "┆ Nenhum médico em serviço"}

━━━━━━━━━━━━━━━━━━━━

📊 **STATUS**
🟢 Ativos: ${pontos.size}
⏱️ Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

💉 Sistema Hospital Premium`
    )
    .setTimestamp();

  msg.edit({ embeds: [embed] }).catch(() => {});
}

// 🔐 PROTEÇÃO STAFF
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  const member = interaction.member;

  // 🚫 BLOQUEIO GLOBAL
  if (interaction.isChatInputCommand() && !isStaff(member)) {
    return interaction.reply({
      content: "❌ Acesso negado (STAFF apenas).",
      ephemeral: true
    });
  }

  // =====================
  // 📌 COMANDOS
  // =====================
  if (interaction.isChatInputCommand()) {

    const user = interaction.user;

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

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

      const msg = await canal.send({
        content: "🏥 Sistema Hospital Ativo",
        components: [row]
      });

      config.painel = canal.id;
      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
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
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === "resetponto") {
      pontos.clear();
      ranking.clear();
      atualizarPainel();

      return interaction.reply({ content: "✅ Resetado!", ephemeral: true });
    }

    if (interaction.commandName === "addhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const ms = (h * 60 + m) * 60000;
      ranking.set(u.id, (ranking.get(u.id) || 0) + ms);

      return interaction.reply({ content: `✅ Adicionado para ${u}`, ephemeral: true });
    }

    if (interaction.commandName === "removerhora") {
      const u = interaction.options.getUser("usuario");
      const h = interaction.options.getInteger("horas");
      const m = interaction.options.getInteger("minutos") || 0;

      const ms = (h * 60 + m) * 60000;
      ranking.set(u.id, Math.max(0, (ranking.get(u.id) || 0) - ms));

      return interaction.reply({ content: `❌ Removido de ${u}`, ephemeral: true });
    }
  }

  // =====================
  // 🔘 BOTÕES
  // =====================
  if (interaction.isButton()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ Apenas STAFF pode usar botões.",
        ephemeral: true
      });
    }

    const id = interaction.user.id;
    const member = interaction.member;

    let ponto = pontos.get(id);

    if (interaction.customId === "iniciar") {
      pontos.set(id, { inicio: Date.now() });

      await member.roles.add(CARGO_EM).catch(()=>{});
      await member.roles.remove(CARGO_FORA).catch(()=>{});

      atualizarPainel();

      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      if (!ponto) {
        return interaction.reply({ content: "❌ Não iniciou!", ephemeral: true });
      }

      const tempo = Date.now() - ponto.inicio;

      ranking.set(id, (ranking.get(id) || 0) + tempo);
      pontos.delete(id);

      await member.roles.remove(CARGO_EM).catch(()=>{});
      await member.roles.add(CARGO_FORA).catch(()=>{});

      atualizarPainel();

      return interaction.reply({
        content: `🔴 Finalizado: ${formatar(tempo)}`,
        ephemeral: true
      });
    }
  }
});

// 🚀 LOGIN
client.login(TOKEN);
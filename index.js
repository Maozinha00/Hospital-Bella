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

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.log("❌ Configure TOKEN, CLIENT_ID e GUILD_ID");
  process.exit(1);
}

// 🛡️ CONFIG
const STAFF_ROLE = "1490431614055088128";
const ROLE_EM_SERVICO = "1492553421973356795";
const ROLE_FORA_SERVICO = "1492553631642288160";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();

// 🚀 CLIENT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers // 🔥 ESSENCIAL
  ]
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ⏱ FUNÇÕES
function tempoRelativo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "agora mesmo";
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m === 1) return "há 1 min";
  return `há ${m} min`;
}

// 👑 HIERARQUIA
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador" }
];

function getBossList(guild) {
  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role || role.members.size === 0) {
      return `Nenhum • ${r.nome}`;
    }
    const member = role.members.first();
    return `<@${member.id}> • ${r.nome}`;
  }).join("\n");
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES
function row() {
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

// 📌 COMMAND
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    )
].map(c => c.toJSON());

// 🔥 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 3000);
});

// 🏥 UPDATE
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    const role = channel.guild.roles.cache.get(ROLE_EM_SERVICO);

    let list = "";

    if (role && role.members.size > 0) {
      role.members.forEach(member => {
        const data = pontos.get(member.id);

        if (data) {
          const tempo = Date.now() - data.inicio;
          list += `<@${member.id}> • ${tempoRelativo(tempo)}\n`;
        } else {
          list += `<@${member.id}> • sem registro\n`;
        }
      });
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

 SISTEMA DE PLANTÃO EM FUNCIONAMENTO

 RESPONSÁVEL DO PLANTÃO
${getBossList(channel.guild)}

────────────────────────────

 EQUIPE EM SERVIÇO
${list}

────────────────────────────

 STATUS
 Médicos ativos: ${role?.members.size || 0}
 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

────────────────────────────

 OBSERVAÇÕES
• Sistema automático de controle de plantão
• Registro de horas em tempo real
• Ranking atualizado continuamente
• Não deixe o ponto aberto

 Hospital Bella • Sistema Profissional
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (err) {
    console.log("⚠️ Erro ao atualizar:", err.message);
  }
}

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Sem permissão", flags: 64 });
    }

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [
          new EmbedBuilder()
            .setDescription("🏥 Painel iniciado...")
            .setColor("#0f172a")
        ],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({
        content: "✅ Painel criado!",
        flags: 64
      });
    }
  }

  if (interaction.isButton()) {

    const member = interaction.member;

    if (interaction.customId === "iniciar") {

      if (member.roles.cache.has(ROLE_EM_SERVICO)) {
        return interaction.reply({ content: "❌ Já está em serviço", flags: 64 });
      }

      await member.roles.add(ROLE_EM_SERVICO);
      await member.roles.remove(ROLE_FORA_SERVICO);

      pontos.set(member.id, { inicio: Date.now() });

      return interaction.reply({ content: "🟢 Serviço iniciado", flags: 64 });
    }

    if (interaction.customId === "finalizar") {

      if (!member.roles.cache.has(ROLE_EM_SERVICO)) {
        return interaction.reply({ content: "❌ Você não está em serviço", flags: 64 });
      }

      await member.roles.remove(ROLE_EM_SERVICO);
      await member.roles.add(ROLE_FORA_SERVICO);

      pontos.delete(member.id);

      return interaction.reply({ content: "🔴 Serviço finalizado", flags: 64 });
    }
  }
});

client.login(TOKEN);

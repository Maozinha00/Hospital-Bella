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

// 🏥 CARGOS
const CARGO_EM_SERVICO = "1492553421973356795";
const CARGO_FORA_SERVICO = "1492553631642288160";

// 🧠 SISTEMA
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 CLIENT (CORRIGIDO)
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

function tempoRelativo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "há poucos segundos";
  if (m === 1) return "há um minuto";
  return `há ${m} minutos`;
}

// 👑 HIERARQUIA (3 diretores + vice + supervisor + 2 coordenadores)
const HIERARQUIA = [
  { id: "1477683902121509018", nome: "Diretor 1" },
  { id: "1477683902121509019", nome: "Diretor 2" },
  { id: "1477683902121509020", nome: "Diretor 3" },
  { id: "1477683902121509017", nome: "Vice Diretor" },
  { id: "1477683902121509016", nome: "Supervisor" },
  { id: "1477683902121509015", nome: "Coordenador 1" },
  { id: "1477683902121509014", nome: "Coordenador 2" }
];

// 👑 HIERARQUIA DISPLAY (CORRIGIDO)
function getBossList(guild) {
  const usados = new Set();

  return HIERARQUIA.map(r => {
    const role = guild.roles.cache.get(r.id);
    if (!role) return `👑 Nenhum • ${r.nome}`;

    const member = role.members.cache
      .filter(m => !usados.has(m.id))
      .first();

    if (!member) return `👑 Nenhum • ${r.nome}`;

    usados.add(member.id);
    return `👑 <@${member.id}> • ${r.nome}`;
  }).join("\n");
}

// 🔐 PERMISSÃO
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 🔘 BOTÕES
function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("🟢 Iniciar Serviço")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("finalizar")
      .setLabel("🔴 Finalizar Serviço")
      .setStyle(ButtonStyle.Danger)
  );
}

// 📌 COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel de bate ponto")
    .addChannelOption(o =>
      o.setName("canal").setDescription("Canal").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("TOP 3 ranking"),

  new SlashCommandBuilder()
    .setName("forcar_entrar")
    .setDescription("Colocar usuário em serviço")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("forcar_sair")
    .setDescription("Retirar usuário do serviço")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    )
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updatePanel, 3000);
});

// 🏥 PAINEL
async function updatePanel() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos.entries()) {
      const time = Date.now() - data.inicio;
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(time)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#00bfff")
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

📊 **STATUS**
• Ativos: ${pontos.size}
• Atualização: 3 segundos

────────────────────────────

🏆 **TOP 3**
${[...ranking.entries()]
  .sort((a,b)=>b[1]-a[1])
  .slice(0,3)
  .map(([id,t],i)=>`${i+1}º <@${id}> • ${format(t)}`)
  .join("\n") || "Sem dados"}

────────────────────────────

🏥 Sistema de Bate Ponto
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch (err) {
    console.log("Erro painel:", err.message);
  }
});

// 🎯 INTERAÇÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

  const member = interaction.member;
  const id = interaction.user.id;

  if (interaction.isChatInputCommand()) {

    if (!isStaff(member))
      return interaction.reply({ content: "❌ Sem permissão", ephemeral: true });

    const user = interaction.options.getUser("usuario");

    if (interaction.commandName === "painelhp") {
      const canal = interaction.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 Painel ativo").setColor("#00bfff")],
        components: [row()]
      });

      config.msgId = msg.id;

      return interaction.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    if (interaction.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a,b)=>b[1]-a[1])
        .slice(0,3)
        .map(([id,t],i)=>`${i+1}º <@${id}> • ${format(t)}`)
        .join("\n");

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🏆 TOP 3").setDescription(top || "Sem dados")]
      });
    }

    if (interaction.commandName === "forcar_entrar") {
      pontos.set(user.id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Em serviço", ephemeral: true });
    }

    if (interaction.commandName === "forcar_sair") {
      const p = pontos.get(user.id);
      if (!p) return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });

      const time = Date.now() - p.inicio;
      ranking.set(user.id, (ranking.get(user.id) || 0) + time);
      pontos.delete(user.id);

      return interaction.reply({ content: `🔴 Saiu • ${format(time)}`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {

    if (interaction.customId === "iniciar") {
      if (pontos.has(id))
        return interaction.reply({ content: "❌ Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      return interaction.reply({ content: "🟢 Iniciado!", ephemeral: true });
    }

    if (interaction.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p)
        return interaction.reply({ content: "❌ Não está em serviço", ephemeral: true });

      const time = Date.now() - p.inicio;
      ranking.set(id, (ranking.get(id) || 0) + time);
      pontos.delete(id);

      return interaction.reply({ content: `🔴 Finalizado • ${format(time)}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);

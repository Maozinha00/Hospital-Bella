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

// 🛡️ STAFF ROLE
const STAFF_ROLE = "1490431614055088128";

// 🧠 SISTEMA HP
let config = { painel: null, msgId: null };
const pontos = new Map();
const ranking = new Map();

// 🚀 BOT
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

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE);
}

// 👑 HIERARQUIA CORRIGIDA
const HIERARQUIA = [
  // 👑 DIRETORES (3)
  { id: "ID_DIRETOR_1", nome: "Diretor 1" },
  { id: "ID_DIRETOR_2", nome: "Diretor 2" },
  { id: "ID_DIRETOR_3", nome: "Diretor 3" },

  // 👑 VICE DIRETOR
  { id: "ID_VICE", nome: "Vice Diretor" },

  // 👑 SUPERVISOR
  { id: "ID_SUPERVISOR", nome: "Supervisor" },

  // 👑 COORDENADORES
  { id: "ID_COORD_1", nome: "Coordenador 1" },
  { id: "ID_COORD_2", nome: "Coordenador 2" }
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

// 📌 COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel HP")
    .addChannelOption(o =>
      o.setName("canal")
        .setDescription("Canal do painel")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Ver ranking HP"),

  new SlashCommandBuilder()
    .setName("forcar_entrar")
    .setDescription("Colocar usuário em serviço")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("forcar_sair")
    .setDescription("Remover usuário do serviço")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuário")
        .setRequired(true)
    )
].map(c => c.toJSON());

// 🚀 READY
client.once("ready", async () => {
  console.log(`🔥 Online: ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  setInterval(updateHP, 3000); // 🔥 atualização rápida
});

// 🏥 PAINEL HP
async function updateHP() {
  try {
    if (!config.painel || !config.msgId) return;

    const channel = await client.channels.fetch(config.painel);
    const msg = await channel.messages.fetch(config.msgId);

    let list = "";

    for (const [id, data] of pontos) {
      list += `👨‍⚕️ <@${id}> • ${tempoRelativo(Date.now() - data.inicio)}\n`;
    }

    if (!list) list = "Nenhum médico em serviço";

    const embed = new EmbedBuilder()
      .setColor("#0f172a")
      .setDescription(`
🏥 ═════════════〔 HOSPITAL BELLA 〕═════════════

**👑 RESPONSÁVEL DO PLANTÃO**
${getBossList(channel.guild)}

────────────────────────────

**👨‍⚕️ EM SERVIÇO**
${list}

────────────────────────────

📊 STATUS
👥 Ativos: ${pontos.size}
🕒 Atualização automática

────────────────────────────
🏥 Hospital Bella • Sistema HP
`);

    await msg.edit({ embeds: [embed], components: [row()] });

  } catch {}
}

// 🎮 INTERAÇÕES
client.on("interactionCreate", async (i) => {

  const id = i.user.id;

  if (i.isButton()) {

    if (i.customId === "iniciar") {
      if (pontos.has(id))
        return i.reply({ content: "❌ Já em serviço", ephemeral: true });

      pontos.set(id, { inicio: Date.now() });
      return i.reply({ content: "🟢 Entrou em serviço", ephemeral: true });
    }

    if (i.customId === "finalizar") {
      const p = pontos.get(id);
      if (!p)
        return i.reply({ content: "❌ Você não está em serviço", ephemeral: true });

      const tempo = Date.now() - p.inicio;

      ranking.set(id, (ranking.get(id) || 0) + tempo);
      pontos.delete(id);

      return i.reply({
        content: `🔴 Saiu do serviço • ${format(tempo)}`,
        ephemeral: true
      });
    }
  }

  if (i.isChatInputCommand()) {

    if (!isStaff(i.member))
      return i.reply({ content: "❌ Sem permissão", ephemeral: true });

    // 🏥 PAINEL
    if (i.commandName === "painelhp") {
      const canal = i.options.getChannel("canal");

      config.painel = canal.id;

      const msg = await canal.send({
        embeds: [new EmbedBuilder().setDescription("🏥 PAINEL HP ATIVO")],
        components: [row()]
      });

      config.msgId = msg.id;

      return i.reply({ content: "✅ Painel criado!", ephemeral: true });
    }

    // 🏆 RANKING
    if (i.commandName === "rankinghp") {
      const top = [...ranking.entries()]
        .sort((a,b) => b[1]-a[1])
        .map(([id,t]) => `<@${id}> • ${format(t)}`)
        .join("\n");

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Ranking HP")
            .setDescription(top || "Sem dados")
        ],
        ephemeral: true
      });
    }

    // 🟢 FORÇAR ENTRAR
    if (i.commandName === "forcar_entrar") {
      const user = i.options.getUser("usuario");
      pontos.set(user.id, { inicio: Date.now() });

      return i.reply({ content: `🟢 ${user.tag} entrou em serviço`, ephemeral: true });
    }

    // 🔴 FORÇAR SAIR
    if (i.commandName === "forcar_sair") {
      const user = i.options.getUser("usuario");

      const p = pontos.get(user.id);
      if (!p)
        return i.reply({ content: "❌ Não está em serviço", ephemeral: true });

      const tempo = Date.now() - p.inicio;

      ranking.set(user.id, (ranking.get(user.id) || 0) + tempo);
      pontos.delete(user.id);

      return i.reply({
        content: `🔴 ${user.tag} removido • ${format(tempo)}`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);

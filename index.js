import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

import express from "express";

// ═══════════════════════════════════════════
// & CONFIGURAÇÕES
// ═══════════════════════════════════════════

const CONFIG = {
  TOKEN: process.env.TOKEN,
  PORT: process.env.PORT || 3000,
  
  // IDs do Servidor
  GUILD_ID: process.env.GUILD_ID || "1477683902041690342",
  STAFF_ROLE_ID: process.env.STAFF_ROLE_ID || "1490431614055088128",
  
  // IDs dos Cargos
  ROLE_EM_SERVICO: process.env.ROLE_EM_SERVICO || "1492553421973356795",
  ROLE_FORA_SERVICO: process.env.ROLE_FORA_SERVICO || "1492553631642288160",
  ROLE_ADVERTENCIA: process.env.ROLE_ADVERTENCIA || "1477683902041690350",
  
  // Tempo máximo de plantão (7 horas em milissegundos)
  TEMPO_MAXIMO_PLANTAO: 7 * 60 * 60 * 1000,
  
  // Intervalos de atualização (em milissegundos)
  INTERVALO_ATUALIZACAO_PAINEL: 30000,
  INTERVALO_VERIFICACAO_TEMPO: 60000,
};

// ═══════════════════════════════════════════
// 🌐 SERVIDOR WEB (Railway)
// ═══════════════════════════════════════════

const app = express();

// Health check para Railway
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    message: "Bot Hospital Bella está funcionando! 🔥",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Endpoint de saúde para Railway
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Endpoint de prontidão
app.get("/ready", (req, res) => {
  res.status(200).json({ 
    ready: true,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(CONFIG.PORT, () => {
  console.log(`🌐 Servidor web rodando na porta ${CONFIG.PORT}`);
  console.log(`🔗 http://localhost:${CONFIG.PORT}`);
});

// ═══════════════════════════════════════════
// 🧠 SISTEMA DE DADOS
// ═══════════════════════════════════════════

class SistemaHospital {
  constructor() {
    this.config = {
      painelCanal: null,
      logsCanal: null,
      mensagemId: null
    };
    
    this.pontosAtivos = new Map();
    this.ranking = new Map();
  }

  formatarTempo(ms) {
    const horas = Math.floor(ms / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  }

  calcularTempoAtivo(dados) {
    let tempo = Date.now() - dados.inicio - dados.pausa;
    
    if (dados.pausado) {
      tempo -= (Date.now() - dados.pausaInicio);
    }
    
    return Math.max(0, tempo);
  }

  obterChefePlantao() {
    let chefeId = null;
    let maiorTempo = 0;

    for (const [id, dados] of this.pontosAtivos) {
      const tempo = this.calcularTempoAtivo(dados);
      
      if (tempo > maiorTempo) {
        maiorTempo = tempo;
        chefeId = id;
      }
    }

    return { id: chefeId, tempo: maiorTempo };
  }

  async atualizarPainel(client) {
    if (!this.config.painelCanal || !this.config.mensagemId) {
      return;
    }

    try {
      const canal = await client.channels.fetch(this.config.painelCanal);
      const mensagem = await canal.messages.fetch(this.config.mensagemId);

      const { id: chefeId, tempo: tempoChefe } = this.obterChefePlantao();
      
      let listaMedicos = "";

      if (this.pontosAtivos.size === 0) {
        listaMedicos = "├─ Nenhum médico em serviço no momento";
      } else {
        for (const [id, dados] of this.pontosAtivos) {
          const tempo = this.calcularTempoAtivo(dados);
          const status = dados.pausado ? "#" : "🟢";
          listaMedicos += `├─ ${status} <@${id}> • ${this.formatarTempo(tempo)}\n`;
        }
      }

      const chefeInfo = chefeId 
        ? `<@${chefeId}> • ${this.formatarTempo(tempoChefe)}`
        : "Nenhum";

      const embed = new EmbedBuilder()
        .setColor("#0f172a")
        .setTitle("🏥 Hospital Bella - Sistema de Plantão")
        .setDescription(
`🏥 ═══════════════════════════
╭━━━━━━━━━━━━━━━━━━━━━╮
┃ 🏥 Sistema Hospitalar Ativo
╰━━━━━━━━━━━━━━━━━━━━━╯

👑 RESPONSÁVEL DO PLANTÃO
${chefeInfo}

👨‍& MÉDICOS EM SERVIÇO
${listaMedicos}

📊 STATUS
├─ 👥 Ativos: ${this.pontosAtivos.size}
└─ 🕒 Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>

Hospital Bella • Sistema de Ponto`
        )
        .setTimestamp()
        .setFooter({ text: "Sistema de Gerenciamento Hospitalar" });

      await mensagem.edit({ embeds: [embed] });
    } catch (error) {
      console.error("❌ Erro ao atualizar painel:", error);
    }
  }

  async verificarTempoMaximo(client) {
    const agora = Date.now();

    for (const [id, dados] of this.pontosAtivos) {
      const tempoTotal = agora - dados.inicio;

      if (tempoTotal >= CONFIG.TEMPO_MAXIMO_PLANTAO) {
        console.log(`⚠️ Usuário ${id} excedeu o tempo máximo de plantão`);
        
        try {
          const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
          const membro = await guild.members.fetch(id).catch(() => null);
          
          if (membro) {
            await membro.roles.add(CONFIG.ROLE_ADVERTENCIA).catch(() => {});
            await membro.roles.remove(CONFIG.ROLE_EM_SERVICO).catch(() => {});
            await membro.roles.add(CONFIG.ROLE_FORA_SERVICO).catch(() => {});
            
            const canalLogs = await client.channels.fetch(this.config.logsCanal).catch(() => null);
            if (canalLogs) {
              await canalLogs.send(
                `⚠️ <@${id}> excedeu o tempo máximo de plantão (7h) e recebeu uma advertência!`
              );
            }
          }
        } catch (error) {
          console.error("❌ Erro ao processar tempo máximo:", error);
        }

        this.pontosAtivos.delete(id);
        this.atualizarPainel(client);
      }
    }
  }

  iniciarPlantao(userId, member) {
    if (this.pontosAtivos.has(userId)) {
      return { sucesso: false, mensagem: "❌ Você já está em plantão!" };
    }

    this.pontosAtivos.set(userId, {
      inicio: Date.now(),
      pausa: 0,
      pausado: false,
      pausaInicio: null
    });

    member.roles.add(CONFIG.ROLE_EM_SERVICO).catch(() => {});
    member.roles.remove(CONFIG.ROLE_FORA_SERVICO).catch(() => {});

    return { sucesso: true, mensagem: "🟢 Plantão iniciado com sucesso!" };
  }

  pausarPlantao(userId) {
    const dados = this.pontosAtivos.get(userId);
    
    if (!dados) {
      return { sucesso: false, mensagem: "❌ Você não está em plantão!" };
    }

    if (!dados.pausado) {
      dados.pausado = true;
      dados.pausaInicio = Date.now();
      return { sucesso: true, mensagem: "# Plantão pausado!" };
    } else {
      dados.pausado = false;
      dados.pausa += (Date.now() - dados.pausaInicio);
      dados.pausaInicio = null;
      return { sucesso: true, mensagem: "▶️ Plantão retomado!" };
    }
  }

  finalizarPlantao(userId, member) {
    const dados = this.pontosAtivos.get(userId);
    
    if (!dados) {
      return { sucesso: false, mensagem: "❌ Você não está em plantão!" };
    }

    if (dados.pausado) {
      dados.pausa += (Date.now() - dados.pausaInicio);
    }

    const tempoTotal = this.calcularTempoAtivo(dados);
    
    const tempoAnterior = this.ranking.get(userId) || 0;
    this.ranking.set(userId, tempoAnterior + tempoTotal);

    this.pontosAtivos.delete(userId);

    member.roles.remove(CONFIG.ROLE_EM_SERVICO).catch(() => {});
    member.roles.add(CONFIG.ROLE_FORA_SERVICO).catch(() => {});

    return { 
      sucesso: true, 
      mensagem: `🔴 Plantão finalizado! Tempo total: ${this.formatarTempo(tempoTotal)}` 
    };
  }

  adicionarHoras(userId, horas, minutos) {
    const tempoEmMs = ((horas * 60) + minutos) * 60000;
    const tempoAtual = this.ranking.get(userId) || 0;
    this.ranking.set(userId, tempoAtual + tempoEmMs);
    
    return this.formatarTempo(this.ranking.get(userId));
  }

  removerHoras(userId, horas, minutos) {
    const tempoEmMs = ((horas * 60) + minutos) * 60000;
    const tempoAtual = this.ranking.get(userId) || 0;
    const novoTempo = Math.max(0, tempoAtual - tempoEmMs);
    this.ranking.set(userId, novoTempo);
    
    return this.formatarTempo(novoTempo);
  }

  resetar() {
    this.pontosAtivos.clear();
    this.ranking.clear();
    this.config = {
      painelCanal: null,
      logsCanal: null,
      mensagemId: null
    };
  }

  obterRanking() {
    return [...this.ranking.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, tempo]) => `<@${id}> • ${this.formatarTempo(tempo)}`)
      .join("\n");
  }
}

// ═══════════════════════════════════════════
// 🤖 CLIENTE DISCORD
// ═══════════════════════════════════════════

const sistema = new SistemaHospital();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);

// ═══════════════════════════════════════════
// 📋 COMANDOS SLASH
// ═══════════════════════════════════════════

const comandos = [
  new SlashCommandBuilder()
    .setName("painelhp")
    .setDescription("Criar painel de controle hospitalar")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal onde o painel será criado")
        .setRequired(true))
    .addChannelOption(option =>
      option.setName("logs")
        .setDescription("Canal de logs do sistema")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("rankinghp")
    .setDescription("Visualizar ranking de horas"),

  new SlashCommandBuilder()
    .setName("resetponto")
    .setDescription("Resetar todo o sistema")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("addhora")
    .setDescription("Adicionar horas ao ranking de um usuário")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Usuário alvo")
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName("horas")
        .setDescription("Quantidade de horas")
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName("minutos")
        .setDescription("Quantidade de minutos")
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("removerhora")
    .setDescription("Remover horas do ranking de um usuário")
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Usuário alvo")
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName("horas")
        .setDescription("Quantidade de horas")
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName("minutos")
        .setDescription("Quantidade de minutos")
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(comando => comando.toJSON());

// ═══════════════════════════════════════════
// 🎯 EVENTOS
// ═══════════════════════════════════════════

client.once("ready", async () => {
  console.log(`✅ Bot ${client.user.tag} está online!`);
  console.log(`📊 Servindo ${client.guilds.cache.size} servidor(es)`);
  console.log(`🌐 Servidor web: http://localhost:${CONFIG.PORT}`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID),
      { body: comandos }
    );
    console.log("✅ Comandos registrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:", error);
  }

  // Atualizações periódicas
  setInterval(() => sistema.atualizarPainel(client), CONFIG.INTERVALO_ATUALIZACAO_PAINEL);
  setInterval(() => sistema.verificarTempoMaximo(client), CONFIG.INTERVALO_VERIFICACAO_TEMPO);
});

client.on("interactionCreate", async (interaction) => {
  
  if (interaction.isChatInputCommand()) {
    await interaction.deferReply({ ephemeral: true });

    const comando = interaction.commandName;

    try {
      switch (comando) {
        
        case "painelhp": {
          const canalPainel = interaction.options.getChannel("canal");
          const canalLogs = interaction.options.getChannel("logs");

          sistema.config.painelCanal = canalPainel.id;
          sistema.config.logsCanal = canalLogs.id;

          const botoes = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("iniciar")
                .setLabel("🟢 Iniciar Plantão")
                .setStyle(ButtonStyle.Success),
              
              new ButtonBuilder()
                .setCustomId("pausar")
                .setLabel("# Pausar/Retomar")
                .setStyle(ButtonStyle.Secondary),
              
              new ButtonBuilder()
                .setCustomId("finalizar")
                .setLabel("🔴 Finalizar Plantão")
                .setStyle(ButtonStyle.Danger)
            );

          const mensagem = await canalPainel.send({
            content: "🏥 **Controle de Plantão Hospitalar**",
            components: [botoes]
          });

          sistema.config.mensagemId = mensagem.id;

          await interaction.editReply({
            content: "✅ Painel criado com sucesso!"
          });
          break;
        }

        case "rankinghp": {
          const rankingTexto = sistema.obterRanking();

          const embed = new EmbedBuilder()
            .setColor("#3b82f6")
            .setTitle("🏆 Ranking de Horas")
            .setDescription(rankingTexto || "📭 Nenhum dado disponível")
            .setFooter({ text: "Hospital Bella - Sistema de Plantão" })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case "resetponto": {
          const membro = await interaction.guild.members.fetch(interaction.user.id);
          
          if (!membro.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({
              content: "❌ Apenas administradores podem usar este comando!"
            });
          }

          sistema.resetar();

          await interaction.editReply({
            content: "✅ Sistema resetado com sucesso!"
          });
          break;
        }

        case "addhora": {
          const usuario = interaction.options.getUser("usuario");
          const horas = interaction.options.getInteger("horas");
          const minutos = interaction.options.getInteger("minutos") || 0;

          const novoTempo = sistema.adicionarHoras(usuario.id, horas, minutos);

          await interaction.editReply({
            content: `✅ ${usuario} agora tem **${novoTempo}** no ranking!`
          });
          break;
        }

        case "removerhora": {
          const usuario = interaction.options.getUser("usuario");
          const horas = interaction.options.getInteger("horas");
          const minutos = interaction.options.getInteger("minutos") || 0;

          const novoTempo = sistema.removerHoras(usuario.id, horas, minutos);

          await interaction.editReply({
            content: `❌ ${usuario} agora tem **${novoTempo}** no ranking!`
          });
          break;
        }
      }
    } catch (error) {
      console.error(`❌ Erro no comando ${comando}:`, error);
      await interaction.editReply({
        content: "❌ Ocorreu um erro ao processar o comando!"
      });
    }
  }

  if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const member = interaction.member;

      if (!member) {
        return interaction.editReply({
          content: "❌ Erro ao obter informações do membro!"
        });
      }

      switch (interaction.customId) {
        
        case "iniciar": {
          const resultado = sistema.iniciarPlantao(userId, member);
          await interaction.editReply({ content: resultado.mensagem });
          break;
        }

        case "pausar": {
          const resultado = sistema.pausarPlantao(userId);
          await interaction.editReply({ content: resultado.mensagem });
          break;
        }

        case "finalizar": {
          const resultado = sistema.finalizarPlantao(userId, member);
          await interaction.editReply({ content: resultado.mensagem });
          break;
        }
      }
    } catch (error) {
      console.error("❌ Erro ao processar botão:", error);
      await interaction.editReply({
        content: "❌ Erro ao processar a ação!"
      });
    }
  }
});

// ═══════════════════════════════════════════
// 🚀 INICIALIZAÇÃO
// ═══════════════════════════════════════════

if (!CONFIG.TOKEN) {
  console.error("❌ TOKEN não encontrado! Configure a variável de ambiente TOKEN");
  process.exit(1);
}

client.login(CONFIG.TOKEN)
  .then(() => console.log("✅ Login realizado com sucesso!"))
  .catch(error => {
    console.error("❌ Erro ao fazer login:", error);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Recebido sinal de encerramento...");
  server.close(() => {
    console.log("✅ Servidor web encerrado");
    client.destroy();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 Recebido sinal de interrupção...");
  server.close(() => {
    console.log("✅ Servidor web encerrado");
    client.destroy();
    process.exit(0);
  });
});

import dotenv from 'dotenv';
import express, { Request, Response, Express } from 'express';
import { IxcService } from './service/ixcService';
import { RenegociacaoService } from './service/renegociacaoService';

dotenv.config();

const app: Express = express();
app.use(express.json());

// Validação de variáveis de ambiente
if (!process.env.IXC_BASE_URL || !process.env.IXC_TOKEN) {
  console.error('❌ Erro: IXC_BASE_URL e IXC_TOKEN devem estar definidos no .env');
  process.exit(1);
}

// Inicializa serviços
const ixcService = new IxcService(
  process.env.IXC_BASE_URL,
  process.env.IXC_TOKEN
);
const renegociacaoService = new RenegociacaoService(ixcService);

/**
 * Endpoint principal para processar renegociações
 * POST /api/processar-renegociacoes
 * Body: { "data": "15/01/2026" } (opcional, usa data atual se não informada)
 */
app.post('/api/processar-renegociacoes', async (req: Request, res: Response) => {
  try {
    // Se não passar data, usa a data atual
    // Para verificar dia anterior, passe a data explicitamente
    const data = req.body.data || ixcService.formatarData(new Date());
    
    console.log(`\n=== Iniciando processamento de renegociações para ${data} ===\n`);
    
    const resultados = await renegociacaoService.processarBoletosPagos(data);
    
    // Filtra apenas os boletos que foram renegociados com sucesso
    const boletosRenegociados = resultados
      .filter(r => r.sucesso)
      .map(r => ({
        idBoleto: r.boletoRenegociado,
        idRenegociacao: r.idRenegociacao,
        idContrato: r.idContrato || r.idContratoAvulso,
        boletoPago: r.boletoPago,
        cenario: r.cenario,
        novaDataVencimento: r.novaDataVencimento,
        jurosMulta: r.jurosMulta
      }));

    const erros = resultados.filter(r => !r.sucesso);

    console.log(`\n=== Processamento concluído ===`);
    console.log(`Total processado: ${resultados.length}`);
    console.log(`Renegociados: ${boletosRenegociados.length}`);
    console.log(`Erros: ${erros.length}\n`);

    res.json({
      sucesso: true,
      data,
      resumo: {
        totalProcessado: resultados.length,
        totalRenegociado: boletosRenegociados.length,
        totalErros: erros.length
      },
      boletosRenegociados,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error: any) {
    console.error('Erro no processamento:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
      detalhes: error.response?.data
    });
  }
});

/**
 * Endpoint para processar um contrato específico
 * POST /api/processar-contrato
 * Body: { "idContrato": "123" } ou { "idContratoAvulso": "456" }
 */
app.post('/api/processar-contrato', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idContrato, idContratoAvulso } = req.body;

    if (!idContrato && !idContratoAvulso) {
      res.status(400).json({
        sucesso: false,
        erro: 'Informe idContrato ou idContratoAvulso'
      });
      return;
    }

    console.log(`\n=== Processando contrato ${idContrato || idContratoAvulso} ===\n`);

    // Busca boletos do contrato
    const boletos = await ixcService.buscarBoletosPorContrato(idContrato, idContratoAvulso);
    
    if (boletos.length === 0) {
      res.json({
        sucesso: true,
        mensagem: 'Nenhum boleto em aberto encontrado para este contrato',
        boletos: []
      });
      return;
    }

    res.json({
      sucesso: true,
      totalBoletos: boletos.length,
      boletos: boletos.map(b => ({
        id: b.id,
        dataVencimento: b.data_vencimento,
        valor: b.valor,
        status: b.status
      }))
    });

  } catch (error: any) {
    console.error('Erro ao processar contrato:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * Endpoint para renegociar um boleto específico manualmente
 * POST /api/renegociar-boleto
 * Body: { "idBoleto": "123456", "novaDataVencimento": "31/01/2026" }
 */
app.post('/api/renegociar-boleto', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idBoleto, novaDataVencimento } = req.body;

    if (!idBoleto || !novaDataVencimento) {
      res.status(400).json({
        sucesso: false,
        erro: 'Informe idBoleto e novaDataVencimento'
      });
      return;
    }

    console.log(`\n=== Renegociando boleto ${idBoleto} ===\n`);

    // Busca dados do boleto
    const boletos = await ixcService.listarBoletos({ id: idBoleto });
    
    if (!boletos.registros || boletos.registros.length === 0) {
      res.status(404).json({
        sucesso: false,
        erro: 'Boleto não encontrado'
      });
      return;
    }

    const boleto = boletos.registros[0];

    // Executa renegociação
    const resultado = await renegociacaoService.executarRenegociacao(
      boleto,
      novaDataVencimento
    );

    res.json({
      sucesso: true,
      mensagem: 'Boleto renegociado com sucesso',
      ...resultado
    });

  } catch (error: any) {
    console.error('Erro ao renegociar boleto:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * Rota raiz com documentação
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    nome: 'API de Renegociação de Boletos IXCSoft',
    versao: '1.0.0',
    endpoints: {
      'POST /api/processar-renegociacoes': {
        descricao: 'Processa automaticamente todos os boletos pagos em uma data',
        body: { data: '15/01/2026 (opcional, padrão: hoje)' }
      },
      'POST /api/processar-contrato': {
        descricao: 'Lista boletos de um contrato específico',
        body: { idContrato: '123' }
      },
      'POST /api/renegociar-boleto': {
        descricao: 'Renegocia um boleto específico manualmente',
        body: { idBoleto: '123456', novaDataVencimento: '31/01/2026' }
      },
      'GET /health': {
        descricao: 'Verifica se a API está funcionando'
      }
    }
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Acesse: http://localhost:${PORT}`);
  console.log(`📋 Documentação: http://localhost:${PORT}\n`);
});

export default app;
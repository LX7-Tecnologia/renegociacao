import { endOfMonth } from 'date-fns';
import { IxcService } from './ixcService';
import {
  Boleto,
  CenarioRenegociacao,
  ResultadoRenegociacao,
  ResultadoProcessamento,
  DadosRenegociacao
} from '../types';

export class RenegociacaoService {
  constructor(private ixcService: IxcService) {}

  /**
   * Processa todos os boletos pagos na data especificada
   */
  async processarBoletosPagos(data: string): Promise<ResultadoProcessamento[]> {
    console.log(`\n🔍 Iniciando processamento de boletos pagos em ${data}...`);
    
    const boletos = await this.ixcService.buscarBoletosPagosNaData(data);
    console.log(`📋 Encontrados ${boletos.length} boleto(s) pago(s).\n`);

    const resultados: ResultadoProcessamento[] = [];

    for (const boletoPago of boletos) {
      try {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔎 Analisando boleto pago: ${boletoPago.id}`);
        console.log(`   Vencimento: ${boletoPago.data_vencimento}`);
        console.log(`   Valor: R$ ${boletoPago.valor}`);
        
        const resultado = await this.analisarERenegociar(boletoPago);
        if (resultado) {
          resultados.push(resultado);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar boleto ${boletoPago.id}:`, error.message);
        resultados.push({
          sucesso: false,
          boletoPago: boletoPago.id,
          erro: error.message
        });
      }
    }

    return resultados;
  }

  /**
   * Analisa um boleto pago e decide se precisa renegociar
   */
  async analisarERenegociar(boletoPago: Boleto): Promise<ResultadoProcessamento | null> {
    const idContrato = boletoPago.id_contrato;
    const idContratoAvulso = boletoPago.id_contrato_avulso;

    if (!idContrato && !idContratoAvulso) {
      console.log(`⚠️  Boleto ${boletoPago.id} não possui contrato vinculado.`);
      return null;
    }

    // Busca todos os boletos em aberto do contrato
    console.log(`   Buscando boletos do contrato...`);
    const boletosContrato = await this.ixcService.buscarBoletosPorContrato(
      idContrato,
      idContratoAvulso
    );

    if (boletosContrato.length === 0) {
      console.log(`✅ Nenhum boleto em aberto no contrato. Tudo certo!`);
      return null;
    }

    console.log(`   Encontrados ${boletosContrato.length} boleto(s) em aberto.`);

    // Analisa o cenário
    const cenario = this.identificarCenario(boletoPago, boletosContrato);
    
    if (!cenario.necessitaRenegociacao) {
      console.log(`✅ ${cenario.motivo}`);
      return null;
    }

    console.log(`\n🔄 RENEGOCIAÇÃO NECESSÁRIA!`);
    console.log(`   Cenário: ${cenario.tipo}`);
    console.log(`   Boleto a renegociar: ${cenario.boletoRenegociar!.id}`);
    console.log(`   Nova data: ${cenario.novaDataVencimento}`);

    // Executa a renegociação
    const resultado = await this.executarRenegociacao(
      cenario.boletoRenegociar!,
      cenario.novaDataVencimento!
    );

    return {
      sucesso: true,
      cenario: cenario.tipo,
      boletoPago: boletoPago.id,
      boletoRenegociado: cenario.boletoRenegociar!.id,
      novaDataVencimento: cenario.novaDataVencimento,
      idContrato: idContrato || undefined,
      idContratoAvulso: idContratoAvulso || undefined,
      ...resultado
    };
  }

  /**
   * Identifica qual cenário de renegociação se aplica
   */
  identificarCenario(boletoPago: Boleto, boletosContrato: Boleto[]): CenarioRenegociacao {
    const dataVencimentoPago = this.ixcService.parseData(boletoPago.data_vencimento);

    // Ordena boletos em aberto por data de vencimento (mais antigo primeiro)
    const boletosOrdenados = boletosContrato
      .filter(b => b.id !== boletoPago.id && b.status === 'A')
      .sort((a, b) => {
        const dataA = this.ixcService.parseData(a.data_vencimento);
        const dataB = this.ixcService.parseData(b.data_vencimento);
        return dataA.getTime() - dataB.getTime();
      });

    if (boletosOrdenados.length === 0) {
      return { 
        necessitaRenegociacao: false, 
        motivo: 'Nenhum outro boleto em aberto' 
      };
    }

    console.log(`   📊 Comparando datas:`);
    console.log(`      Boleto pago: ${boletoPago.data_vencimento}`);
    boletosOrdenados.forEach(b => {
      console.log(`      Boleto em aberto: ${b.id} - Vencimento: ${b.data_vencimento}`);
    });

    // CENÁRIO 2: Pagou um boleto no mês vigente (não vencido) e há um vencido do mês anterior
    const now = new Date();
    const boletoPagoNoMesVigente =
      dataVencimentoPago.getFullYear() === now.getFullYear() &&
      dataVencimentoPago.getMonth() === now.getMonth();
    
    const boletosVencidosAnteriores = boletosOrdenados.filter(b => {
      const dataVenc = this.ixcService.parseData(b.data_vencimento);
      return dataVenc < dataVencimentoPago; // Vencido
    });

    if (boletoPagoNoMesVigente && boletosVencidosAnteriores.length > 0) {
      const boletoVencidoMaisAntigo = boletosVencidosAnteriores[0];

      // Nova data: último dia do MÊS do boleto PAGO (não do mês atual!)
      // Se pagou em 05/02, renegocia para 28/02 (último dia de fevereiro)
      const ultimoDiaMesDoBoletoPago = endOfMonth(dataVencimentoPago);
      const novaDataVencimento = this.ixcService.formatarData(ultimoDiaMesDoBoletoPago);

      console.log(`   🎯 CENÁRIO IDENTIFICADO: Pagamento no mês vigente, mas existe boleto vencido do mês anterior`);
      console.log(`      Pago: ${boletoPago.data_vencimento} (${boletoPago.id})`);
      console.log(`      Vencido anterior: ${boletoVencidoMaisAntigo.data_vencimento} (${boletoVencidoMaisAntigo.id})`);
      
      console.log(`   📅 Nova data de vencimento calculada: ${novaDataVencimento}`);
      
      return {
        necessitaRenegociacao: true,
        tipo: 'PAGOU_MES_VIGENTE',
        boletoRenegociar: boletoVencidoMaisAntigo,
        novaDataVencimento,
        descricao: `Cliente pagou boleto de ${boletoPago.data_vencimento} mas tinha boleto vencido de ${boletoVencidoMaisAntigo.data_vencimento}. Renegociando para ${novaDataVencimento}`
      };
    }

    // CENÁRIO 1: Pagou um boleto POSTERIOR quando existe um ANTERIOR em aberto
    // (aplicado apenas quando não caiu no cenário 2 acima)
    const boletoMaisAntigo = boletosOrdenados[0];
    const dataVencimentoMaisAntigo = this.ixcService.parseData(boletoMaisAntigo.data_vencimento);

    if (dataVencimentoPago > dataVencimentoMaisAntigo) {
      console.log(`   🎯 CENÁRIO IDENTIFICADO: Pagou boleto posterior`);
      console.log(`      Pago: ${boletoPago.data_vencimento} (${boletoPago.id})`);
      console.log(`      Em aberto anterior: ${boletoMaisAntigo.data_vencimento} (${boletoMaisAntigo.id})`);
      
      return {
        necessitaRenegociacao: true,
        tipo: 'PAGOU_PROXIMO_MES',
        boletoRenegociar: boletoMaisAntigo,
        novaDataVencimento: boletoPago.data_vencimento,
        descricao: `Cliente pagou boleto de ${boletoPago.data_vencimento} mas tinha boleto de ${boletoMaisAntigo.data_vencimento} em aberto`
      };
    }

    return { 
      necessitaRenegociacao: false, 
      motivo: 'Pagamento correto, não necessita renegociação' 
    };
  }

  /**
   * Executa todo o fluxo de renegociação seguindo a documentação IXC
   */
  async executarRenegociacao(
    boletoOriginal: Boleto,
    novaDataVencimento: string
  ): Promise<ResultadoRenegociacao> {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║  INICIANDO RENEGOCIAÇÃO - Boleto ${boletoOriginal.id.padEnd(10)} ║`);
    console.log(`╚════════════════════════════════════════════════╝\n`);

    // PASSO 1: Inicia renegociação
    console.log(`[1/7] 🚀 Iniciando renegociação...`);
    const renegociacaoIniciada = await this.ixcService.iniciarRenegociacao([boletoOriginal.id]);
    const idRenegociacao = renegociacaoIniciada.id_renegociacao;

    // PASSO 2: Prepara dados da renegociação
    console.log(`[2/7] 📝 Preparando dados da renegociação...`);
    const dadosRenegociacao: DadosRenegociacao = {
      id_filial: boletoOriginal.id_filial,
      id_conta: boletoOriginal.id_conta,
      id_cliente: boletoOriginal.id_cliente,
      data_emissao: this.ixcService.formatarData(new Date()),
      previsao: 'S',
      id_carteira_cobranca: boletoOriginal.id_carteira_cobranca,
      id_condicao_pagamento: boletoOriginal.id_condicao_pagamento,
      contrato_renegociacao: boletoOriginal.id_contrato || boletoOriginal.id_contrato_avulso || '',
      data_vencimento: novaDataVencimento,
      valor_parcelas: boletoOriginal.valor,
      valor_acrescimos: '0,00',
      valor_descontos: '0,00',
      valor_total: boletoOriginal.valor,
      valor_renegociado: boletoOriginal.valor,
      valor_total_pagar: boletoOriginal.valor,
      status: 'A',
      finalizar: 'N'
    };

    await this.ixcService.atualizarRenegociacao(idRenegociacao, dadosRenegociacao);

    // PASSO 3: Calcula juros e multa
    console.log(`[3/7] 💰 Calculando juros e multa...`);
    const jurosMulta = await this.ixcService.calcularJurosMulta(
      boletoOriginal.id_carteira_cobranca,
      boletoOriginal.id_condicao_pagamento,
      idRenegociacao
    );

    // Se houver juros/multa, atualiza os valores
    if (jurosMulta.totalFineAndFess && jurosMulta.totalFineAndFess !== '0,00') {
      console.log(`   ⚠️  Juros/Multa aplicados: R$ ${jurosMulta.totalFineAndFess}`);
      const valorTotalComJuros = this.somarValores(
        boletoOriginal.valor,
        jurosMulta.totalFineAndFess
      );
      
      dadosRenegociacao.acre_juros_multa = jurosMulta.totalFineAndFess;
      dadosRenegociacao.valor_parcelas = valorTotalComJuros;
      dadosRenegociacao.valor_total = valorTotalComJuros;
      dadosRenegociacao.valor_renegociado = valorTotalComJuros;
      dadosRenegociacao.valor_total_pagar = valorTotalComJuros;
    } else {
      console.log(`   ✅ Sem juros/multa a aplicar`);
    }

    // PASSO 4: Finaliza renegociação
    console.log(`[4/7] ✔️  Finalizando renegociação...`);
    await this.ixcService.finalizarRenegociacao(idRenegociacao, dadosRenegociacao);

    // PASSO 5: Busca o boleto gerado pela renegociação
    console.log(`[5/7] 🔍 Buscando boleto gerado...`);
    let boletoRenegociado: Boleto;
    
    try {
      boletoRenegociado = await this.ixcService.buscarBoletoRenegociado(idRenegociacao);
    } catch (error) {
      // Plano B: Busca o boleto mais recente do contrato
      console.log(`   ⚠️  Usando método alternativo: buscando último boleto do contrato...`);
      const boletosContrato = await this.ixcService.buscarBoletosPorContrato(
        boletoOriginal.id_contrato,
        boletoOriginal.id_contrato_avulso
      );
      
      // Ordena por ID (mais recente primeiro) e pega o primeiro
      const boletosOrdenados = boletosContrato.sort((a, b) => 
        parseInt(b.id) - parseInt(a.id)
      );
      
      if (boletosOrdenados.length === 0) {
        throw new Error('Nenhum boleto encontrado no contrato após renegociação');
      }
      
      boletoRenegociado = boletosOrdenados[0];
      console.log(`   ✅ Boleto encontrado via método alternativo: ${boletoRenegociado.id}`);
    }

    // PASSO 6: Corrige a data de vencimento (workaround para bug da API)
    console.log(`[6/7] 🔧 Corrigindo data de vencimento (bug IXC)...`);
    await this.ixcService.corrigirDataVencimento(
      boletoRenegociado.id,
      boletoOriginal,
      novaDataVencimento
    );

    // PASSO 7: Gera o boleto em base64
    console.log(`[7/7] 📄 Gerando boleto em PDF...`);
    const boletoBase64 = await this.ixcService.gerarBoleto(boletoRenegociado.id);

    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║  ✅ RENEGOCIAÇÃO CONCLUÍDA COM SUCESSO!       ║`);
    console.log(`╚════════════════════════════════════════════════╝`);
    console.log(`   ID Renegociação: ${idRenegociacao}`);
    console.log(`   Boleto Original: ${boletoOriginal.id}`);
    console.log(`   Boleto Novo: ${boletoRenegociado.id}`);
    console.log(`   Nova Data: ${novaDataVencimento}`);
    console.log(`   Valor Total: R$ ${dadosRenegociacao.valor_total_pagar}\n`);

    return {
      idRenegociacao,
      idBoleto: boletoRenegociado.id,
      jurosMulta: jurosMulta.totalFineAndFess,
      boletoBase64
    };
  }

  /**
   * Soma valores no formato brasileiro (com vírgula)
   */
  private somarValores(valor1: string, valor2: string): string {
    const v1 = parseFloat(valor1.replace(',', '.'));
    const v2 = parseFloat(valor2.replace(',', '.'));
    const soma = v1 + v2;
    return soma.toFixed(2).replace('.', ',');
  }
}

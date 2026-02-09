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
    const boletos = await this.ixcService.buscarBoletosPagosNaData(data);

    const resultados: ResultadoProcessamento[] = [];

    for (const boletoPago of boletos) {
      try {
        const resultado = await this.analisarERenegociar(boletoPago);
        if (resultado) {
          resultados.push(resultado);
        }
      } catch (error: any) {
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
      return null;
    }

    // Busca todos os boletos em aberto do contrato
    const boletosContrato = await this.ixcService.buscarBoletosPorContrato(
      idContrato,
      idContratoAvulso
    );

    if (boletosContrato.length === 0) {
      return null;
    }

    // Analisa o cenário
    const cenario = this.identificarCenario(boletoPago, boletosContrato);
    
    if (!cenario.necessitaRenegociacao) {
      return null;
    }

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
      const ultimoDiaMesDoBoletoPago = endOfMonth(dataVencimentoPago);
      const novaDataVencimento = this.ixcService.formatarData(ultimoDiaMesDoBoletoPago);
      
      return {
        necessitaRenegociacao: true,
        tipo: 'PAGOU_MES_VIGENTE',
        boletoRenegociar: boletoVencidoMaisAntigo,
        novaDataVencimento,
        descricao: `Cliente pagou boleto de ${boletoPago.data_vencimento} mas tinha boleto vencido de ${boletoVencidoMaisAntigo.data_vencimento}. Renegociando para ${novaDataVencimento}`
      };
    }

    // CENÁRIO 1: Pagou um boleto POSTERIOR quando existe um ANTERIOR em aberto
    const boletoMaisAntigo = boletosOrdenados[0];
    const dataVencimentoMaisAntigo = this.ixcService.parseData(boletoMaisAntigo.data_vencimento);

    if (dataVencimentoPago > dataVencimentoMaisAntigo) {
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
    // PASSO 1: Inicia renegociação
    const renegociacaoIniciada = await this.ixcService.iniciarRenegociacao([boletoOriginal.id]);
    const idRenegociacao = renegociacaoIniciada.id_renegociacao;

    // PASSO 2: Prepara dados da renegociação
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
    const jurosMulta = await this.ixcService.calcularJurosMulta(
      boletoOriginal.id_carteira_cobranca,
      boletoOriginal.id_condicao_pagamento,
      idRenegociacao
    );

    // Se houver juros/multa, atualiza os valores
    if (jurosMulta.totalFineAndFess && jurosMulta.totalFineAndFess !== '0,00') {
      const valorTotalComJuros = this.somarValores(
        boletoOriginal.valor,
        jurosMulta.totalFineAndFess
      );
      
      dadosRenegociacao.acre_juros_multa = jurosMulta.totalFineAndFess;
      dadosRenegociacao.valor_parcelas = valorTotalComJuros;
      dadosRenegociacao.valor_total = valorTotalComJuros;
      dadosRenegociacao.valor_renegociado = valorTotalComJuros;
      dadosRenegociacao.valor_total_pagar = valorTotalComJuros;
    }

    // PASSO 4: Finaliza renegociação
    await this.ixcService.finalizarRenegociacao(idRenegociacao, dadosRenegociacao);

    // PASSO 5: Busca o boleto gerado pela renegociação
    let boletoRenegociado: Boleto;
    
    try {
      boletoRenegociado = await this.ixcService.buscarBoletoRenegociado(idRenegociacao);
    } catch (error) {
      // Plano B: Busca o boleto mais recente do contrato
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
    }

    // PASSO 6: Corrige a data de vencimento (workaround para bug da API)
    await this.ixcService.corrigirDataVencimento(
      boletoRenegociado.id,
      boletoOriginal,
      novaDataVencimento
    );

    // PASSO 7: Gera o boleto em base64
    const boletoBase64 = await this.ixcService.gerarBoleto(boletoRenegociado.id);

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

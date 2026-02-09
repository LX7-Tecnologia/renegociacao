import axios, { AxiosInstance } from 'axios';
import {
  Boleto,
  BoletosPaginados,
  RenegociacaoIniciada,
  RenegociacaoAtualizada,
  JurosMulta,
  DadosRenegociacao
} from '../types';

export class IxcService {
  private client: AxiosInstance;

  constructor(baseUrl: string, token: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    });
  }

  async listarBoletos(filtros: Record<string, any> = {}): Promise<BoletosPaginados> {
    try {
      const response = await this.client.get<BoletosPaginados>('/fn_areceber', {
        headers: { ixcsoft: 'listar' },
        params: {
          qtype: 'fn_areceber.id',
          query: '0',
          oper: '>',
          page: '1',
          rp: '1000',
          sortname: 'fn_areceber.id',
          sortorder: 'desc',
          ...filtros
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao listar boletos:', error.response?.data || error.message);
      throw error;
    }
  }

  async buscarBoletosPagosNaData(data: string): Promise<Boleto[]> {
    try {
      const response = await this.client.post<BoletosPaginados>('/fn_areceber', {
        qtype: 'fn_areceber.id',
        query: '0',
        oper: '>',
        page: '1',
        rp: '1000',
        sortname: 'fn_areceber.id',
        sortorder: 'desc',
        grid_param: JSON.stringify([{
          TB: 'fn_areceber.pagamento_data',
          OP: '=',
          P: this.normalizarData(data)
        }])
      }, {
        headers: { ixcsoft: 'listar' }
      });
      return response.data.registros || [];
    } catch (error: any) {
      console.error('Erro ao buscar boletos pagos:', error.response?.data || error.message);
      throw error;
    }
  }

  async buscarBoletosPorContrato(
    idContrato?: string,
    idContratoAvulso?: string
  ): Promise<Boleto[]> {
    try {
      const filtros: Array<{ TB: string; OP: string; P: string }> = [];
      
      if (idContrato) {
        filtros.push({
          TB: 'fn_areceber.id_contrato',
          OP: '=',
          P: idContrato
        });
      }
      
      if (idContratoAvulso) {
        filtros.push({
          TB: 'fn_areceber.id_contrato_avulso',
          OP: '=',
          P: idContratoAvulso
        });
      }

      filtros.push({
        TB: 'fn_areceber.status',
        OP: '=',
        P: 'A'
      });

      const response = await this.client.post<BoletosPaginados>('/fn_areceber', {
        qtype: 'fn_areceber.id',
        query: '0',
        oper: '>',
        page: '1',
        rp: '1000',
        sortname: 'fn_areceber.data_vencimento',
        sortorder: 'asc',
        grid_param: JSON.stringify(filtros)
      }, {
        headers: { ixcsoft: 'listar' }
      });

      return response.data.registros || [];
    } catch (error: any) {
      console.error('Erro ao buscar boletos por contrato:', error.response?.data || error.message);
      throw error;
    }
  }

  async iniciarRenegociacao(idsBoletos: string[]): Promise<RenegociacaoIniciada> {
    try {
      const response = await this.client.post<RenegociacaoIniciada>('/renegociar_selecionados', {
        get_id: idsBoletos.join(',')
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao iniciar renegociação:', error.response?.data || error.message);
      throw error;
    }
  }

  async atualizarRenegociacao(
    idRenegociacao: number,
    dados: DadosRenegociacao
  ): Promise<RenegociacaoAtualizada> {
    try {
      const dadosAtualizacao: DadosRenegociacao = {
        id_filial: '1',
        id_conta: '286',
        id_cliente: dados.id_cliente,
        data_emissao: this.normalizarData(dados.data_emissao),
        previsao: 'S',
        id_carteira_cobranca: '3',
        id_condicao_pagamento: '1',
        vendedor_renegociacao: '',
        contrato_renegociacao: dados.contrato_renegociacao,
        data_vencimento: this.normalizarData(dados.data_vencimento),
        valor_parcelas: dados.valor_total,
        valor_acrescimos: '0,00',
        valor_descontos: '0,00',
        valor_total: dados.valor_total,
        valor_renegociado: dados.valor_total,
        acre_juros_multa: '',
        valor_total_pagar: dados.valor_total,
        status: dados.status || 'A',
        data_finalizada: '',
        finalizar: 'N',
      };

      const response = await this.client.put<RenegociacaoAtualizada>(
        `/fn_renegociacao_wiz/${idRenegociacao}`,
        dadosAtualizacao
      );

      return response.data;
    } catch (error: any) {
      console.error('Erro ao atualizar renegociação:', error.response?.data || error.message);
      throw error;
    }
  }

  async calcularJurosMulta(
    idCarteiraCobranca: string,
    idCondicaoPagamento: string,
    idRenegociacao: number
  ): Promise<JurosMulta> {
    try {
      const response = await this.client.post<JurosMulta>('/calcula_juros_multa', {
        id_carteira_cobranca: idCarteiraCobranca,
        id_condicao_pagamento: idCondicaoPagamento,
        id: idRenegociacao.toString()
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao calcular juros/multa:', error.response?.data || error.message);
      throw error;
    }
  }

  async finalizarRenegociacao(
    idRenegociacao: number,
    dados: DadosRenegociacao
  ): Promise<RenegociacaoAtualizada> {
    try {
      const dadosFinalizacao: DadosRenegociacao = {
        id_filial: '1',
        id_conta: '286',
        id_cliente: dados.id_cliente,
        data_emissao: this.normalizarData(dados.data_emissao),
        previsao: 'S',
        id_carteira_cobranca: '3',
        id_condicao_pagamento: '1',
        vendedor_renegociacao: '',
        contrato_renegociacao: dados.contrato_renegociacao,
        data_vencimento: this.normalizarData(dados.data_vencimento),
        valor_parcelas: dados.valor_parcelas,
        valor_acrescimos: dados.valor_acrescimos || '0,00',
        valor_descontos: '0,00',
        valor_total: dados.valor_total,
        valor_renegociado: dados.valor_renegociado,
        acre_juros_multa: dados.acre_juros_multa || '',
        valor_total_pagar: dados.valor_total_pagar,
        status: 'A',
        data_finalizada: this.formatarData(new Date()),
        finalizar: 'S'
      };

      const response = await this.client.put<RenegociacaoAtualizada>(
        `/fn_renegociacao_wiz/${idRenegociacao}`,
        dadosFinalizacao
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Erro ao finalizar renegociação:', error.response?.data || error.message);
      throw error;
    }
  }

  async buscarBoletoRenegociado(
    idRenegociacao: number,
    tentativas = 8,
    delayMs = 2000
  ): Promise<Boleto> {
    for (let i = 1; i <= tentativas; i++) {
      try {
        const response = await this.client.post<BoletosPaginados>('/fn_areceber', {
          qtype: 'fn_areceber.status',
          query: 'A',
          oper: '=',
          page: '1',
          rp: '20',
          sortname: 'fn_areceber.id',
          sortorder: 'desc'
        }, {
          headers: { ixcsoft: 'listar' }
        });

        const boletos = response.data.registros || [];
        
        if (boletos.length > 0) {
          const boletoNovo = boletos.find(b => b.status === 'A');
          if (boletoNovo) {
            return boletoNovo;
          }
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error: any) {
        if (i === tentativas) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(`Boleto da renegociação ${idRenegociacao} não foi encontrado após ${tentativas} tentativas`);
  }

  async corrigirDataVencimento(
    idBoleto: string,
    boletoRenegociado: Boleto,
    novaDataVencimento: string
  ): Promise<any> {
    try {
      const dataVencimentoFormatada = novaDataVencimento.includes('-') 
        ? this.formatarData(this.parseData(novaDataVencimento))
        : novaDataVencimento;

      const dataVencimentoOriginalFormatada = boletoRenegociado.data_vencimento.includes('-')
        ? this.formatarData(this.parseData(boletoRenegociado.data_vencimento))
        : boletoRenegociado.data_vencimento;

      const dataEmissaoFormatada = boletoRenegociado.data_emissao.includes('-')
        ? this.formatarData(this.parseData(boletoRenegociado.data_emissao))
        : boletoRenegociado.data_emissao;

      const response = await this.client.put(`/fn_areceber_altera/${idBoleto}`, {
        documento: '',
        data_emissao: dataEmissaoFormatada,
        data_vencimento: dataVencimentoFormatada,
        id_carteira_cobranca: boletoRenegociado.id_carteira_cobranca,
        obs: `Boleto de vencimento original ${dataVencimentoOriginalFormatada}`,
        tipo_recebimento: 'Gateway',
        status: 'A',
        aguardando_confirmacao_pagamento: '',
        nn_boleto: '',
        pix_txid: '',
        libera_periodo: 'S',
        liberado: 'S',
        titulo_protestado: '',
        id_remessa_alteracao: '',
        motivo_alteracao: ''
      });

      return response.data;
    } catch (error: any) {
      console.error('Erro ao corrigir data de vencimento:', error.response?.data || error.message);
      throw error;
    }
  }

  async gerarBoleto(idBoleto: string): Promise<any> {
    try {
      const response = await this.client.post('/get_boleto', {
        boletos: idBoleto,
        juro: '',
        multa: '',
        atualiza_boleto: '',
        tipo_boleto: 'arquivo',
        base64: 'S',
        layout_impressao: ''
      });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao gerar boleto:', error.response?.data || error.message);
      throw error;
    }
  }

  formatarData(data: Date): string {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  parseData(dataString: string): Date {
    if (!dataString) {
      throw new Error('Data vazia');
    }

    const limpa = dataString.trim();

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpa)) {
      const [dia, mes, ano] = limpa.split('/');
      return new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia)
      );
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(limpa)) {
      const [data] = limpa.split(' ');
      const [ano, mes, dia] = data.split('-');

      return new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia)
      );
    }

    throw new Error(`Formato de data inválido: ${dataString}`);
  }

  normalizarData(data: string): string {
    return this.formatarData(this.parseData(data));
  }
}

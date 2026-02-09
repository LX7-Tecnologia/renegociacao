export interface Boleto {
  id: string;
  id_cliente: string;
  id_contrato?: string;
  id_contrato_avulso?: string;
  id_filial: string;
  id_conta: string;
  id_carteira_cobranca: string;
  data_vencimento: string;
  data_emissao: string;
  valor: string;
  status: string;
  previsao?: string;
  pagamento_data?: string;
  documento?: string;
  nn_boleto?: string;
  tipo_recebimento: string;
  pix_txid: string;
  titulo_protestado: string;
  id_remessa_alteracao: string;
  id_condicao_pagamento: string;
}

export interface BoletosPaginados {
  registros: Boleto[];
  total: number;
  page: number;
}

export interface RenegociacaoIniciada {
  id_renegociacao: number;
  message: string;
  type: string;
}

export interface RenegociacaoAtualizada {
  type: string;
  message: string;
  id: string;
}

export interface JurosMulta {
  totalFineAndFess: string;
  dateExpiration: string;
  message: string;
  type: string;
}

export interface DadosRenegociacao {
  id_filial: string;
  id_conta: string;
  id_cliente: string;
  data_emissao: string;
  previsao: string;
  id_carteira_cobranca: string;
  id_condicao_pagamento: string;
  vendedor_renegociacao?: string;
  contrato_renegociacao: string;
  data_vencimento: string;
  valor_parcelas: string;
  valor_acrescimos: string;
  valor_descontos: string;
  valor_total: string;
  valor_renegociado: string;
  acre_juros_multa?: string;
  valor_total_pagar: string;
  status: string;
  data_finalizada?: string;
  finalizar: string;
}

export interface CenarioRenegociacao {
  necessitaRenegociacao: boolean;
  tipo?: 'PAGOU_PROXIMO_MES' | 'PAGOU_MES_VIGENTE' | 'PAGOU_MAIS_RECENTE';
  boletoRenegociar?: Boleto;
  novaDataVencimento?: string;
  descricao?: string;
  motivo?: string;
}

export interface ResultadoRenegociacao {
  idRenegociacao: number;
  idBoleto: string;
  jurosMulta: string;
  boletoBase64: any;
}

export interface ResultadoProcessamento {
  sucesso: boolean;
  cenario?: string;
  boletoPago?: string;
  boletoRenegociado?: string;
  novaDataVencimento?: string;
  idContrato?: string;
  idContratoAvulso?: string;
  idRenegociacao?: number;
  idBoleto?: string;
  jurosMulta?: string;
  boletoBase64?: any;
  erro?: string;
}

export interface ResumoProcessamento {
  totalProcessado: number;
  totalRenegociado: number;
  totalErros: number;
}

export interface BoletoRenegociadoInfo {
  idBoleto: string;
  idRenegociacao: number;
  boletoPago: string;
  cenario: string;
  novaDataVencimento: string;
  jurosMulta: string;
}
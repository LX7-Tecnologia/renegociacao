import { RenegociacaoService } from "../renegociacaoService";
import { IxcService } from "../ixcService";
import { Boleto } from "../../types";

jest.mock("../ixcService");

// Helper para criar boleto mock com todas as propriedades obrigatórias
const createMockBoleto = (overrides: Partial<Boleto> = {}): Boleto => ({
  id: "1",
  id_cliente: "1",
  id_contrato: "10",
  id_filial: "1",
  id_conta: "1",
  id_carteira_cobranca: "1",
  id_condicao_pagamento: "1",
  data_vencimento: "01/01/2026",
  data_emissao: "01/12/2025",
  valor: "100.00",
  status: "A",
  tipo_recebimento: "Gateway",
  pix_txid: "",
  titulo_protestado: "",
  id_remessa_alteracao: "",
  ...overrides,
});

describe("RenegociacaoService", () => {
  let renegociacaoService: RenegociacaoService;
  let mockIxcService: jest.Mocked<IxcService>;

  beforeEach(() => {
    mockIxcService = new IxcService("", "") as jest.Mocked<IxcService>;
    renegociacaoService = new RenegociacaoService(mockIxcService);
    jest.clearAllMocks();
  });

  describe("identificarCenario", () => {
    const hoje = new Date(2026, 0, 15); // 15/01/2026

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(hoje);
      mockIxcService.parseData = jest.fn((dateStr: string) => {
        const [dia, mes, ano] = dateStr.split("/");
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      });
      mockIxcService.formatarData = jest.fn((data: Date) => {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${dia}/${mes}/${ano}`;
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("deve identificar cenário PAGOU_PROXIMO_MES quando pagou boleto posterior", () => {
      const boletoPago = createMockBoleto({
        id: "100",
        data_vencimento: "13/02/2026", // Pagou boleto de fevereiro
        data_emissao: "13/01/2026",
        status: "P",
      });

      const boletosContrato: Boleto[] = [
        createMockBoleto({
          id: "101",
          data_vencimento: "13/01/2026", // Boleto de janeiro vencido
          data_emissao: "13/12/2025",
          status: "A",
        }),
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(true);
      expect(cenario.tipo).toBe("PAGOU_PROXIMO_MES");
      expect(cenario.boletoRenegociar?.id).toBe("101");
      expect(cenario.novaDataVencimento).toBe("13/02/2026");
    });

    it("deve identificar cenário PAGOU_MES_VIGENTE quando pagou no mês atual mas tem vencido anterior", () => {
      const boletoPago = createMockBoleto({
        id: "100",
        data_vencimento: "20/01/2026", // Pagou boleto de janeiro (mês vigente)
        data_emissao: "20/12/2025",
        status: "P",
      });

      const boletosContrato: Boleto[] = [
        createMockBoleto({
          id: "101",
          data_vencimento: "10/12/2025", // Boleto de dezembro vencido
          data_emissao: "10/11/2025",
          status: "A",
        }),
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(true);
      expect(cenario.tipo).toBe("PAGOU_MES_VIGENTE");
      expect(cenario.boletoRenegociar?.id).toBe("101");
      // Deve renegociar para último dia do mês do boleto pago (janeiro)
      expect(cenario.novaDataVencimento).toBe("31/01/2026");
    });

    it("não deve renegociar quando pagamento está correto", () => {
      const boletoPago = createMockBoleto({
        id: "100",
        data_vencimento: "13/01/2026",
        data_emissao: "13/12/2025",
        status: "P",
      });

      const boletosContrato: Boleto[] = [
        createMockBoleto({
          id: "101",
          data_vencimento: "13/02/2026", // Próximo boleto no futuro
          data_emissao: "13/01/2026",
          status: "A",
        }),
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(false);
      expect(cenario.motivo).toBe("Pagamento correto, não necessita renegociação");
    });

    it("não deve renegociar quando não há outros boletos", () => {
      const boletoPago = createMockBoleto({
        id: "100",
        data_vencimento: "13/01/2026",
        data_emissao: "13/12/2025",
        status: "P",
      });

      const boletosContrato: Boleto[] = [];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(false);
      expect(cenario.motivo).toBe("Nenhum outro boleto em aberto");
    });

    it("deve ignorar boletos que não estão em aberto (status diferente de 'A')", () => {
      const boletoPago = createMockBoleto({
        id: "100",
        data_vencimento: "13/02/2026",
        data_emissao: "13/01/2026",
        status: "P",
      });

      const boletosContrato: Boleto[] = [
        createMockBoleto({
          id: "101",
          data_vencimento: "13/01/2026",
          data_emissao: "13/12/2025",
          status: "P", // Já pago, não deve renegociar
        }),
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(false);
      expect(cenario.motivo).toBe("Nenhum outro boleto em aberto");
    });
  });

  describe("executarRenegociacao", () => {
    const boleto = createMockBoleto({
      id: "123",
      data_vencimento: "13/01/2026",
      data_emissao: "13/12/2025",
      valor: "100.00",
      status: "A",
    });

    beforeEach(() => {
      mockIxcService.formatarData = jest.fn((data: Date) => {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${dia}/${mes}/${ano}`;
      });
    });

    it("deve executar renegociação completa com sucesso", async () => {
      const boletoRenegociado = createMockBoleto({
        id: "124",
        data_vencimento: "31/01/2026",
      });

      mockIxcService.iniciarRenegociacao = jest.fn().mockResolvedValue({
        id_renegociacao: 643,
        message: "Sucesso",
        type: "success",
      });

      mockIxcService.atualizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Atualizado",
        id: "643",
      });

      mockIxcService.calcularJurosMulta = jest.fn().mockResolvedValue({
        totalFineAndFess: "0,00",
        dateExpiration: "2026-01-31",
        message: "",
        type: "success",
      });

      mockIxcService.finalizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Finalizado",
        id: "643",
      });

      mockIxcService.buscarBoletoRenegociado = jest.fn().mockResolvedValue(boletoRenegociado);

      mockIxcService.corrigirDataVencimento = jest.fn().mockResolvedValue({
        type: "success",
      });

      mockIxcService.gerarBoleto = jest.fn().mockResolvedValue({
        base64: "mock_base64",
        type: "success",
      });

      const resultado = await renegociacaoService.executarRenegociacao(
        boleto,
        "31/01/2026"
      );

      expect(resultado.idRenegociacao).toBe(643);
      expect(resultado.idBoleto).toBe("124");
      expect(mockIxcService.iniciarRenegociacao).toHaveBeenCalledWith(["123"]);
      expect(mockIxcService.atualizarRenegociacao).toHaveBeenCalled();
      expect(mockIxcService.calcularJurosMulta).toHaveBeenCalled();
      expect(mockIxcService.finalizarRenegociacao).toHaveBeenCalled();
      expect(mockIxcService.buscarBoletoRenegociado).toHaveBeenCalledWith(643);
      expect(mockIxcService.corrigirDataVencimento).toHaveBeenCalledWith(
        "124",
        boleto,
        "31/01/2026"
      );
      expect(mockIxcService.gerarBoleto).toHaveBeenCalledWith("124");
    });

    it("deve incluir juros e multa quando calculados", async () => {
      const boletoRenegociado = createMockBoleto({
        id: "124",
        data_vencimento: "31/01/2026",
      });

      mockIxcService.iniciarRenegociacao = jest.fn().mockResolvedValue({
        id_renegociacao: 643,
        message: "Sucesso",
        type: "success",
      });

      mockIxcService.atualizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Atualizado",
        id: "643",
      });

      mockIxcService.calcularJurosMulta = jest.fn().mockResolvedValue({
        totalFineAndFess: "15,50",
        dateExpiration: "2026-01-31",
        message: "",
        type: "success",
      });

      mockIxcService.finalizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Finalizado",
        id: "643",
      });

      mockIxcService.buscarBoletoRenegociado = jest.fn().mockResolvedValue(boletoRenegociado);

      mockIxcService.corrigirDataVencimento = jest.fn().mockResolvedValue({
        type: "success",
      });

      mockIxcService.gerarBoleto = jest.fn().mockResolvedValue({
        base64: "mock_base64",
        type: "success",
      });

      const resultado = await renegociacaoService.executarRenegociacao(
        boleto,
        "31/01/2026"
      );

      expect(resultado.jurosMulta).toBe("15,50");
      expect(mockIxcService.atualizarRenegociacao).toHaveBeenCalledTimes(1);
      expect(mockIxcService.finalizarRenegociacao).toHaveBeenCalledWith(
        643,
        expect.objectContaining({
          acre_juros_multa: "15,50",
          valor_total_pagar: "115,50",
        })
      );
    });

    it("deve usar método alternativo quando buscarBoletoRenegociado falhar", async () => {
      const boletoRenegociado = createMockBoleto({
        id: "124",
        data_vencimento: "31/01/2026",
      });

      mockIxcService.iniciarRenegociacao = jest.fn().mockResolvedValue({
        id_renegociacao: 643,
        message: "Sucesso",
        type: "success",
      });

      mockIxcService.atualizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Atualizado",
        id: "643",
      });

      mockIxcService.calcularJurosMulta = jest.fn().mockResolvedValue({
        totalFineAndFess: "0,00",
        dateExpiration: "2026-01-31",
        message: "",
        type: "success",
      });

      mockIxcService.finalizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Finalizado",
        id: "643",
      });

      // Simula falha no método principal
      mockIxcService.buscarBoletoRenegociado = jest
        .fn()
        .mockRejectedValue(new Error("Boleto não encontrado"));

      // Método alternativo retorna o boleto
      mockIxcService.buscarBoletosPorContrato = jest.fn().mockResolvedValue([
        boletoRenegociado,
      ]);

      mockIxcService.corrigirDataVencimento = jest.fn().mockResolvedValue({
        type: "success",
      });

      mockIxcService.gerarBoleto = jest.fn().mockResolvedValue({
        base64: "mock_base64",
        type: "success",
      });

      const resultado = await renegociacaoService.executarRenegociacao(
        boleto,
        "31/01/2026"
      );

      expect(resultado.idBoleto).toBe("124");
      expect(mockIxcService.buscarBoletosPorContrato).toHaveBeenCalledWith(
        "10",
        undefined
      );
    });

    it("deve propagar erro quando renegociação falhar", async () => {
      mockIxcService.iniciarRenegociacao = jest
        .fn()
        .mockRejectedValue(new Error("Erro ao iniciar renegociação"));

      await expect(
        renegociacaoService.executarRenegociacao(boleto, "31/01/2026")
      ).rejects.toThrow("Erro ao iniciar renegociação");
    });

    it("deve propagar erro quando método alternativo também falhar", async () => {
      mockIxcService.iniciarRenegociacao = jest.fn().mockResolvedValue({
        id_renegociacao: 643,
        message: "Sucesso",
        type: "success",
      });

      mockIxcService.atualizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Atualizado",
        id: "643",
      });

      mockIxcService.calcularJurosMulta = jest.fn().mockResolvedValue({
        totalFineAndFess: "0,00",
        dateExpiration: "2026-01-31",
        message: "",
        type: "success",
      });

      mockIxcService.finalizarRenegociacao = jest.fn().mockResolvedValue({
        type: "success",
        message: "Finalizado",
        id: "643",
      });

      // Ambos os métodos falham
      mockIxcService.buscarBoletoRenegociado = jest
        .fn()
        .mockRejectedValue(new Error("Boleto não encontrado"));

      mockIxcService.buscarBoletosPorContrato = jest.fn().mockResolvedValue([]);

      await expect(
        renegociacaoService.executarRenegociacao(boleto, "31/01/2026")
      ).rejects.toThrow("Nenhum boleto encontrado no contrato após renegociação");
    });
  });

  describe("processarBoletosPagos", () => {
    it("deve processar múltiplos boletos pagos", async () => {
      const boletosPagos: Boleto[] = [
        createMockBoleto({
          id: "100",
          data_vencimento: "13/02/2026",
          data_emissao: "13/01/2026",
          status: "P",
          pagamento_data: "15/01/2026",
        }),
      ];

      mockIxcService.buscarBoletosPagosNaData = jest
        .fn()
        .mockResolvedValue(boletosPagos);
      mockIxcService.buscarBoletosPorContrato = jest.fn().mockResolvedValue([]);

      const resultados = await renegociacaoService.processarBoletosPagos(
        "15/01/2026"
      );

      expect(mockIxcService.buscarBoletosPagosNaData).toHaveBeenCalledWith(
        "15/01/2026"
      );
      expect(resultados).toBeDefined();
      expect(Array.isArray(resultados)).toBe(true);
    });

    it("deve continuar processamento mesmo com erros", async () => {
      const boletosPagos: Boleto[] = [
        createMockBoleto({
          id: "100",
          data_vencimento: "13/02/2026",
          data_emissao: "13/01/2026",
          status: "P",
          pagamento_data: "15/01/2026",
        }),
      ];

      mockIxcService.buscarBoletosPagosNaData = jest
        .fn()
        .mockResolvedValue(boletosPagos);
      mockIxcService.buscarBoletosPorContrato = jest
        .fn()
        .mockRejectedValue(new Error("Erro ao buscar"));

      const resultados = await renegociacaoService.processarBoletosPagos(
        "15/01/2026"
      );

      expect(resultados).toHaveLength(1);
      expect(resultados[0].sucesso).toBe(false);
      expect(resultados[0].erro).toBe("Erro ao buscar");
    });

    it("deve retornar null quando boleto não tem contrato vinculado", async () => {
      const boletosPagos: Boleto[] = [
        createMockBoleto({
          id: "100",
          data_vencimento: "13/02/2026",
          data_emissao: "13/01/2026",
          status: "P",
          pagamento_data: "15/01/2026",
          id_contrato: undefined,
          id_contrato_avulso: undefined,
        }),
      ];

      mockIxcService.buscarBoletosPagosNaData = jest
        .fn()
        .mockResolvedValue(boletosPagos);

      const resultados = await renegociacaoService.processarBoletosPagos(
        "15/01/2026"
      );

      expect(resultados).toHaveLength(0);
    });
  });
});
import { RenegociacaoService } from "../renegociacaoService";
import { IxcService } from "../ixcService";
import { Boleto } from "../../types";

jest.mock("../ixcService");

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
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("deve identificar cenário PAGOU_PROXIMO_MES", () => {
      const boletoPago: Boleto = {
        id: "100",
        id_cliente: "1",
        id_contrato: "10",
        id_filial: "1",
        id_conta: "1",
        id_carteira_cobranca: "1",
        data_vencimento: "13/02/2026", // Pagou boleto de fevereiro
        data_emissao: "13/01/2026",
        valor: "100.00",
        status: "P",
      };

      const boletosContrato: Boleto[] = [
        {
          id: "101",
          id_cliente: "1",
          id_contrato: "10",
          id_filial: "1",
          id_conta: "1",
          id_carteira_cobranca: "1",
          data_vencimento: "13/01/2026", // Boleto de janeiro vencido
          data_emissao: "13/12/2025",
          valor: "100.00",
          status: "A",
        },
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

    it("deve identificar cenário PAGOU_MAIS_RECENTE", () => {
      mockIxcService.formatarData = jest.fn((_data: Date) => "31/01/2026");

      const boletoPago: Boleto = {
        id: "100",
        id_cliente: "1",
        id_contrato: "10",
        id_filial: "1",
        id_conta: "1",
        id_carteira_cobranca: "1",
        data_vencimento: "10/01/2026", // Pagou boleto de janeiro
        data_emissao: "10/12/2025",
        valor: "100.00",
        status: "P",
      };

      const boletosContrato: Boleto[] = [
        {
          id: "101",
          id_cliente: "1",
          id_contrato: "10",
          id_filial: "1",
          id_conta: "1",
          id_carteira_cobranca: "1",
          data_vencimento: "10/12/2025", // Boleto de dezembro vencido
          data_emissao: "10/11/2025",
          valor: "100.00",
          status: "A",
        },
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(true);
      expect(cenario.tipo).toBe("PAGOU_MAIS_RECENTE");
      expect(cenario.boletoRenegociar?.id).toBe("101");
      expect(cenario.novaDataVencimento).toBe("31/01/2026");
    });

    it("não deve renegociar quando pagamento está correto", () => {
      const boletoPago: Boleto = {
        id: "100",
        id_cliente: "1",
        id_contrato: "10",
        id_filial: "1",
        id_conta: "1",
        id_carteira_cobranca: "1",
        data_vencimento: "13/01/2026",
        data_emissao: "13/12/2025",
        valor: "100.00",
        status: "P",
      };

      const boletosContrato: Boleto[] = [
        {
          id: "101",
          id_cliente: "1",
          id_contrato: "10",
          id_filial: "1",
          id_conta: "1",
          id_carteira_cobranca: "1",
          data_vencimento: "13/02/2026", // Próximo boleto no futuro
          data_emissao: "13/01/2026",
          valor: "100.00",
          status: "A",
        },
      ];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(false);
      expect(cenario.motivo).toBeDefined();
    });

    it("não deve renegociar quando não há outros boletos", () => {
      const boletoPago: Boleto = {
        id: "100",
        id_cliente: "1",
        id_contrato: "10",
        id_filial: "1",
        id_conta: "1",
        id_carteira_cobranca: "1",
        data_vencimento: "13/01/2026",
        data_emissao: "13/12/2025",
        valor: "100.00",
        status: "P",
      };

      const boletosContrato: Boleto[] = [];

      const cenario = renegociacaoService.identificarCenario(
        boletoPago,
        boletosContrato
      );

      expect(cenario.necessitaRenegociacao).toBe(false);
      expect(cenario.motivo).toBe("Nenhum outro boleto em aberto");
    });
  });

  describe("executarRenegociacao", () => {
    const boleto: Boleto = {
      id: "123",
      id_cliente: "1",
      id_contrato: "10",
      id_filial: "1",
      id_conta: "1",
      id_carteira_cobranca: "1",
      data_vencimento: "13/01/2026",
      data_emissao: "13/12/2025",
      valor: "100.00",
      status: "A",
    };

    it("deve executar renegociação completa com sucesso", async () => {
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

      mockIxcService.corrigirDataVencimento = jest.fn().mockResolvedValue({
        type: "success",
      });

      mockIxcService.gerarBoleto = jest.fn().mockResolvedValue({
        base64: "mock_base64",
      });

      mockIxcService.formatarData = jest.fn((_data: Date) => "15/01/2026");

      const resultado = await renegociacaoService.executarRenegociacao(
        boleto,
        "31/01/2026"
      );

      expect(resultado.idRenegociacao).toBe(643);
      expect(resultado.idBoleto).toBe("123");
      expect(mockIxcService.iniciarRenegociacao).toHaveBeenCalledWith(["123"]);
      expect(mockIxcService.corrigirDataVencimento).toHaveBeenCalledWith(
        "123",
        "31/01/2026"
      );
    });

    it("deve incluir juros e multa quando calculados", async () => {
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

      mockIxcService.corrigirDataVencimento = jest.fn().mockResolvedValue({
        type: "success",
      });

      mockIxcService.gerarBoleto = jest.fn().mockResolvedValue({
        base64: "mock_base64",
      });

      mockIxcService.formatarData = jest.fn((_data: Date) => "15/01/2026");

      const resultado = await renegociacaoService.executarRenegociacao(
        boleto,
        "31/01/2026"
      );

      expect(resultado.jurosMulta).toBe("15,50");
    });

    it("deve propagar erro quando renegociação falhar", async () => {
      mockIxcService.iniciarRenegociacao = jest
        .fn()
        .mockRejectedValue(new Error("Erro ao iniciar renegociação"));

      await expect(
        renegociacaoService.executarRenegociacao(boleto, "31/01/2026")
      ).rejects.toThrow("Erro ao iniciar renegociação");
    });
  });

  describe("processarBoletosPagos", () => {
    it("deve processar múltiplos boletos pagos", async () => {
      const boletosPagos: Boleto[] = [
        {
          id: "100",
          id_cliente: "1",
          id_contrato: "10",
          id_filial: "1",
          id_conta: "1",
          id_carteira_cobranca: "1",
          data_vencimento: "13/02/2026",
          data_emissao: "13/01/2026",
          valor: "100.00",
          status: "P",
          pagamento_data: "15/01/2026",
        },
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
    });

    it("deve continuar processamento mesmo com erros", async () => {
      const boletosPagos: Boleto[] = [
        {
          id: "100",
          id_cliente: "1",
          id_contrato: "10",
          id_filial: "1",
          id_conta: "1",
          id_carteira_cobranca: "1",
          data_vencimento: "13/02/2026",
          data_emissao: "13/01/2026",
          valor: "100.00",
          status: "P",
          pagamento_data: "15/01/2026",
        },
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
  });
});

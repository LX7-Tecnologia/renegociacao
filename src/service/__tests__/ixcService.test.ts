import axios from "axios";
import { IxcService } from "../ixcService";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("IxcService", () => {
  let ixcService: IxcService;
  const mockBaseUrl = "https://test.ixcsoft.com.br/webservice/v1";
  const mockToken = "Basic mock_token";

  beforeEach(() => {
    ixcService = new IxcService(mockBaseUrl, mockToken);
    jest.clearAllMocks();
  });

  describe("formatarData", () => {
    it("deve formatar data no padrão DD/MM/YYYY", () => {
      const data = new Date(2026, 0, 15); // 15/01/2026
      const resultado = ixcService.formatarData(data);
      expect(resultado).toBe("15/01/2026");
    });

    it("deve adicionar zeros à esquerda quando necessário", () => {
      const data = new Date(2026, 0, 5); // 05/01/2026
      const resultado = ixcService.formatarData(data);
      expect(resultado).toBe("05/01/2026");
    });
  });

  describe("parseData", () => {
    it("deve converter string DD/MM/YYYY para objeto Date", () => {
      const dataString = "15/01/2026";
      const resultado = ixcService.parseData(dataString);
      expect(resultado).toEqual(new Date(2026, 0, 15));
    });

    it("deve lidar corretamente com datas no final do ano", () => {
      const dataString = "31/12/2025";
      const resultado = ixcService.parseData(dataString);
      expect(resultado).toEqual(new Date(2025, 11, 31));
    });
  });

  describe("buscarBoletosPagosNaData", () => {
    it("deve buscar boletos pagos em uma data específica", async () => {
      const mockResponse = {
        data: {
          registros: [
            {
              id: "123",
              id_cliente: "456",
              data_vencimento: "15/01/2026",
              valor: "100.00",
              pagamento_data: "15/01/2026",
            },
          ],
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletosPagosNaData("15/01/2026");

      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe("123");
    });

    it("deve retornar array vazio quando não há boletos", async () => {
      const mockResponse = {
        data: {
          registros: [],
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletosPagosNaData("15/01/2026");

      expect(resultado).toHaveLength(0);
    });

    it("deve lançar erro quando a requisição falhar", async () => {
      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error("Erro de rede")),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);

      await expect(
        ixcService.buscarBoletosPagosNaData("15/01/2026")
      ).rejects.toThrow("Erro de rede");
    });
  });

  describe("buscarBoletosPorContrato", () => {
    it("deve buscar boletos por id_contrato", async () => {
      const mockResponse = {
        data: {
          registros: [
            {
              id: "789",
              id_contrato: "123",
              data_vencimento: "15/01/2026",
              valor: "150.00",
              status: "A",
            },
          ],
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletosPorContrato("123");

      expect(resultado).toHaveLength(1);
      expect(resultado[0].id_contrato).toBe("123");
    });

    it("deve buscar boletos por id_contrato_avulso", async () => {
      const mockResponse = {
        data: {
          registros: [
            {
              id: "999",
              id_contrato_avulso: "456",
              data_vencimento: "20/01/2026",
              valor: "200.00",
              status: "A",
            },
          ],
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletosPorContrato(
        undefined,
        "456"
      );

      expect(resultado).toHaveLength(1);
      expect(resultado[0].id_contrato_avulso).toBe("456");
    });
  });

  describe("iniciarRenegociacao", () => {
    it("deve iniciar renegociação com sucesso", async () => {
      const mockResponse = {
        data: {
          id_renegociacao: 643,
          message: "Renegociação incluída com sucesso!",
          type: "success",
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.iniciarRenegociacao(["123", "456"]);

      expect(resultado.id_renegociacao).toBe(643);
      expect(resultado.type).toBe("success");
    });
  });

  describe("calcularJurosMulta", () => {
    it("deve calcular juros e multa", async () => {
      const mockResponse = {
        data: {
          totalFineAndFess: "15,50",
          dateExpiration: "2026-01-15",
          message: "",
          type: "success",
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.calcularJurosMulta("1", "1", 643);

      expect(resultado.totalFineAndFess).toBe("15,50");
      expect(resultado.type).toBe("success");
    });

    it("deve retornar zero quando não há juros", async () => {
      const mockResponse = {
        data: {
          totalFineAndFess: "0,00",
          dateExpiration: "2026-01-15",
          message: "",
          type: "success",
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.calcularJurosMulta("1", "1", 643);

      expect(resultado.totalFineAndFess).toBe("0,00");
    });
  });

  describe("corrigirDataVencimento", () => {
    it("deve corrigir data de vencimento do boleto", async () => {
      const mockResponse = {
        data: {
          type: "success",
          message: "Registro atualizado com sucesso!",
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        put: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.corrigirDataVencimento(
        "123",
        "31/01/2026"
      );

      expect(resultado.type).toBe("success");
    });
  });

  describe("gerarBoleto", () => {
    it("deve gerar boleto em base64", async () => {
      const mockResponse = {
        data: {
          base64: "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvUGFnZXMKL...",
          type: "success",
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.gerarBoleto("123");

      expect(resultado.type).toBe("success");
      expect(resultado.base64).toBeDefined();
    });
  });
});

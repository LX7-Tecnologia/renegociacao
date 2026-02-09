import axios from "axios";
import { IxcService } from "../ixcService";
import { Boleto } from "../../types";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

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

    it("deve formatar corretamente meses com zero à esquerda", () => {
      const data = new Date(2026, 2, 9); // 09/03/2026
      const resultado = ixcService.formatarData(data);
      expect(resultado).toBe("09/03/2026");
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

    it("deve converter string YYYY-MM-DD para objeto Date", () => {
      const dataString = "2026-01-15";
      const resultado = ixcService.parseData(dataString);
      expect(resultado).toEqual(new Date(2026, 0, 15));
    });

    it("deve ignorar parte de hora em YYYY-MM-DD HH:mm:ss", () => {
      const dataString = "2026-01-15 14:30:00";
      const resultado = ixcService.parseData(dataString);
      expect(resultado).toEqual(new Date(2026, 0, 15));
    });

    it("deve lançar erro para data vazia", () => {
      expect(() => ixcService.parseData("")).toThrow("Data vazia");
    });

    it("deve lançar erro para formato inválido", () => {
      expect(() => ixcService.parseData("2026/01/15")).toThrow(
        "Formato de data inválido: 2026/01/15"
      );
    });
  });

  describe("normalizarData", () => {
    it("deve normalizar data de YYYY-MM-DD para DD/MM/YYYY", () => {
      const resultado = ixcService.normalizarData("2026-01-15");
      expect(resultado).toBe("15/01/2026");
    });

    it("deve manter data já no formato DD/MM/YYYY", () => {
      const resultado = ixcService.normalizarData("15/01/2026");
      expect(resultado).toBe("15/01/2026");
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

    it("deve incluir filtro de status aberto", async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { registros: [] },
      });

      mockedAxios.create = jest.fn().mockReturnValue({
        post: mockPost,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      await ixcService.buscarBoletosPorContrato("123");

      const callArgs = mockPost.mock.calls[0][1];
      const gridParam = JSON.parse(callArgs.grid_param);

      expect(gridParam).toContainEqual({
        TB: "fn_areceber.status",
        OP: "=",
        P: "A",
      });
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

    it("deve formatar IDs como string separada por vírgula", async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { id_renegociacao: 643, type: "success" },
      });

      mockedAxios.create = jest.fn().mockReturnValue({
        post: mockPost,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      await ixcService.iniciarRenegociacao(["123", "456", "789"]);

      expect(mockPost).toHaveBeenCalledWith("/renegociar_selecionados", {
        get_id: "123,456,789",
      });
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

      const mockPut = jest.fn().mockResolvedValue(mockResponse);

      mockedAxios.create = jest.fn().mockReturnValue({
        put: mockPut,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);

      const boletoRenegociado = createMockBoleto({
        id: "124",
        id_carteira_cobranca: "3",
        data_vencimento: "15/01/2026",
        data_emissao: "01/01/2026",
      });

      const resultado = await ixcService.corrigirDataVencimento(
        "123",
        boletoRenegociado,
        "31/01/2026"
      );

      expect(resultado.type).toBe("success");
      expect(mockPut).toHaveBeenCalledWith(
        "/fn_areceber_altera/123",
        expect.objectContaining({
          data_vencimento: "31/01/2026",
          status: "A",
        })
      );
    });

    it("deve converter data YYYY-MM-DD para DD/MM/YYYY", async () => {
      const mockResponse = {
        data: {
          type: "success",
          message: "Registro atualizado com sucesso!",
        },
      };

      const mockPut = jest.fn().mockResolvedValue(mockResponse);

      mockedAxios.create = jest.fn().mockReturnValue({
        put: mockPut,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);

      const boletoRenegociado = createMockBoleto({
        id: "124",
        id_carteira_cobranca: "3",
        data_vencimento: "2026-01-15",
        data_emissao: "2026-01-01",
      });

      await ixcService.corrigirDataVencimento(
        "123",
        boletoRenegociado,
        "2026-01-31"
      );

      expect(mockPut).toHaveBeenCalledWith(
        "/fn_areceber_altera/123",
        expect.objectContaining({
          data_vencimento: "31/01/2026",
          data_emissao: "01/01/2026",
        })
      );
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

    it("deve enviar parâmetros corretos para gerar boleto", async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { base64: "mock", type: "success" },
      });

      mockedAxios.create = jest.fn().mockReturnValue({
        post: mockPost,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      await ixcService.gerarBoleto("123");

      expect(mockPost).toHaveBeenCalledWith("/get_boleto", {
        boletos: "123",
        juro: "",
        multa: "",
        atualiza_boleto: "",
        tipo_boleto: "arquivo",
        base64: "S",
        layout_impressao: "",
      });
    });
  });

  describe("buscarBoletoRenegociado", () => {
    it("deve encontrar boleto na primeira tentativa", async () => {
      const mockResponse = {
        data: {
          registros: [
            createMockBoleto({
              id: "124",
              status: "A",
              data_vencimento: "31/01/2026",
            }),
          ],
        },
      };

      mockedAxios.create = jest.fn().mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletoRenegociado(643);

      expect(resultado.id).toBe("124");
    });

    it("deve fazer retry até encontrar boleto", async () => {
      let attempts = 0;
      const mockPost = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ data: { registros: [] } });
        }
        return Promise.resolve({
          data: {
            registros: [createMockBoleto({ id: "124", status: "A" })],
          },
        });
      });

      mockedAxios.create = jest.fn().mockReturnValue({
        post: mockPost,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);
      const resultado = await ixcService.buscarBoletoRenegociado(643, 5, 100);

      expect(resultado.id).toBe("124");
      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it("deve lançar erro após esgotar tentativas", async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { registros: [] },
      });

      mockedAxios.create = jest.fn().mockReturnValue({
        post: mockPost,
      } as any);

      ixcService = new IxcService(mockBaseUrl, mockToken);

      await expect(
        ixcService.buscarBoletoRenegociado(643, 3, 100)
      ).rejects.toThrow(
        "Boleto da renegociação 643 não foi encontrado após 3 tentativas"
      );
    });
  });
});
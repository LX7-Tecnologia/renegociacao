# 🔄 Sistema de Renegociação Automática de Boletos IXCSoft

Sistema Node.js com TypeScript para automatizar o processo de renegociação de boletos quando clientes pagam boletos incorretos na plataforma IXCSoft.

## 📋 Índice

- [Cenários Tratados](#-cenários-tratados)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração](#️-configuração)
- [Executando a Aplicação](#-executando-a-aplicação)
- [Testando](#-testando)
- [API Endpoints](#-api-endpoints)
- [Integração com N8N](#-integração-com-n8n)
- [Exemplos de Uso](#-exemplos-de-uso)
- [Troubleshooting](#-troubleshooting)

## 🎯 Cenários Tratados

### Cenário 1: Pagamento do Boleto do Próximo Mês
**Situação:** Cliente tem boleto vencendo em 13/01 mas paga o de 13/02 por engano.

**Ação Automática:** O sistema identifica e renegocia o boleto de 13/01 para vencer em 13/02.

### Cenário 2: Pagamento do Boleto Mais Recente com Pendência Anterior
**Situação:** Cliente tem dois boletos vencidos (10/12/2025 e 10/01/2026) e paga o mais recente (10/01).

**Ação Automática:** O sistema renegocia o boleto de 10/12 para o último dia do mês atual.

## 📦 Requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **pnpm** (gerenciador de pacotes)
- Acesso à API da **IXCSoft**
- **N8N** (para automação - opcional)

### Instalando o pnpm

Se você ainda não tem o pnpm instalado:

```bash
# Via npm
npm install -g pnpm

# Via Homebrew (macOS)
brew install pnpm

# Via Scoop (Windows)
scoop install pnpm
```

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/renegociacao-boletos-ixc.git
cd renegociacao-boletos-ixc
```

### 2. Instale as dependências

```bash
pnpm install
```

Este comando instalará todas as dependências necessárias:

**Produção:**
- `express` - Framework web
- `axios` - Cliente HTTP
- `dotenv` - Variáveis de ambiente
- `date-fns` - Manipulação de datas

**Desenvolvimento:**
- `typescript` - Compilador TypeScript
- `jest` - Framework de testes
- `eslint` - Linter de código
- Outras ferramentas de desenvolvimento

## ⚙️ Configuração

### 1. Crie o arquivo de variáveis de ambiente

```bash
cp .env.example .env
```

### 2. Configure suas credenciais IXCSoft

Edite o arquivo `.env`:

```env
PORT=3000

IXC_BASE_URL=https://seudominio.ixcsoft.com.br/webservice/v1
IXC_TOKEN=Basic SEU_TOKEN_AQUI_EM_BASE64
```

### 3. Como obter e configurar o token IXC

O token IXC está no formato `usuario:senha`. Você precisa converter para Base64:

**Exemplo:** Se seu token é `6:4dacdb8e47193e8cbbabe508c3c59b4547e463817b1d9b9a1d20ab4812fe1a62`

**Opção A - Via Node.js:**
```javascript
node -e "console.log(Buffer.from('6:4dacdb8e47193e8cbbabe508c3c59b4547e463817b1d9b9a1d20ab4812fe1a62').toString('base64'))"
```

**Opção B - Via site:**
Acesse [base64encode.org](https://www.base64encode.org/) e cole seu token.

**Resultado no .env:**
```env
IXC_TOKEN=Basic Njo0ZGFjZGI4ZTQ3MTkzZThjYmJhYmU1MDhjM2M1OWI0NTQ3ZTQ2MzgxN2IxZDliOWExZDIwYWI0ODEyZmUxYTYy
```

⚠️ **Importante:** O prefixo `Basic ` deve estar presente antes do token em Base64.

## 🏃 Executando a Aplicação

### Compilar TypeScript

```bash
pnpm build
```

Isso compilará os arquivos `.ts` para `.js` na pasta `dist/`.

### Modo Produção

```bash
pnpm start
```

### Modo Desenvolvimento (com hot-reload)

```bash
pnpm dev
```

Você verá a mensagem:

```
🚀 Servidor rodando na porta 3000
📍 Acesse: http://localhost:3000
📋 Documentação: http://localhost:3000
```

## 🧪 Testando

### Executar todos os testes

```bash
pnpm test
```

### Testes em modo watch (útil durante desenvolvimento)

```bash
pnpm test:watch
```

### Gerar relatório de cobertura

```bash
pnpm test:coverage
```

O relatório será gerado em `coverage/lcov-report/index.html`.

### Verificar qualidade do código

```bash
pnpm lint
```

## 📡 API Endpoints

A API estará disponível em `http://localhost:3000` (ou na porta configurada).

### 1. Processar Renegociações Automáticas ⭐

**Endpoint principal** que processa todos os boletos pagos em uma data específica.

```http
POST /api/processar-renegociacoes
Content-Type: application/json

{
  "data": "15/01/2026"  // Opcional, usa data atual se não informado
}
```

**Response de Sucesso:**
```json
{
  "sucesso": true,
  "data": "15/01/2026",
  "resumo": {
    "totalProcessado": 5,
    "totalRenegociado": 2,
    "totalErros": 0
  },
  "boletosRenegociados": [
    {
      "idBoleto": "145367",
      "idRenegociacao": 643,
      "boletoPago": "145370",
      "cenario": "PAGOU_PROXIMO_MES",
      "novaDataVencimento": "13/02/2026",
      "jurosMulta": "15,50"
    },
    {
      "idBoleto": "145368",
      "idRenegociacao": 644,
      "boletoPago": "145371",
      "cenario": "PAGOU_MAIS_RECENTE",
      "novaDataVencimento": "31/01/2026",
      "jurosMulta": "0,00"
    }
  ]
}
```

### 2. Processar Contrato Específico

Lista todos os boletos em aberto de um contrato.

```http
POST /api/processar-contrato
Content-Type: application/json

{
  "idContrato": "123"
  // OU
  "idContratoAvulso": "456"
}
```

### 3. Renegociar Boleto Manualmente

Renegocia um boleto específico para uma nova data.

```http
POST /api/renegociar-boleto
Content-Type: application/json

{
  "idBoleto": "145367",
  "novaDataVencimento": "31/01/2026"
}
```

### 4. Health Check

Verifica se a API está funcionando.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T18:30:00.000Z"
}
```

## 🤖 Integração com N8N

O N8N é uma ferramenta de automação de workflows. Veja como integrar:

### Cenário 1: Processamento Automático Diário

**Objetivo:** Processar automaticamente todos os boletos pagos no dia, todo dia às 18h.

#### Passo 1: Criar Workflow no N8N

1. Abra o N8N
2. Crie um novo workflow
3. Adicione os seguintes nodes:

```
[Schedule Trigger] → [HTTP Request] → [IF] → [Code] → [WhatsApp/Email]
```

#### Passo 2: Configurar Schedule Trigger

- **Node Type:** Schedule Trigger
- **Trigger Times:** Cron
- **Expression:** `0 18 * * *` (Todo dia às 18h)

Ou use a interface visual:
- **Mode:** Every Day
- **Hour:** 18
- **Minute:** 0

#### Passo 3: Configurar HTTP Request

- **Method:** POST
- **URL:** `http://seu-servidor:3000/api/processar-renegociacoes`
- **Authentication:** None
- **Send Body:** Yes
- **Body Content Type:** JSON
- **Specify Body:** Using JSON

**Body:**
```json
{
  "data": "={{ $now.format('DD/MM/YYYY') }}"
}
```

#### Passo 4: Configurar IF Node

Verifica se há boletos renegociados antes de enviar notificação.

- **Condition:** `{{ $json.resumo.totalRenegociado }}` > 0

#### Passo 5: Configurar Code Node (Formatar Mensagem)

Cole este código no Code Node:

```javascript
const response = $input.first().json;

if (response.sucesso && response.boletosRenegociados.length > 0) {
  let mensagem = `🔄 *Renegociações Processadas - ${response.data}*\n\n`;
  mensagem += `📊 *Resumo:*\n`;
  mensagem += `✅ Total renegociado: ${response.resumo.totalRenegociado}\n`;
  mensagem += `📋 Total processado: ${response.resumo.totalProcessado}\n\n`;
  
  mensagem += `*Detalhes dos Boletos:*\n\n`;
  
  response.boletosRenegociados.forEach((boleto, index) => {
    mensagem += `${index + 1}. *Boleto:* ${boleto.idBoleto}\n`;
    mensagem += `   📅 Nova data: ${boleto.novaDataVencimento}\n`;
    mensagem += `   💰 Juros/Multa: R$ ${boleto.jurosMulta}\n`;
    mensagem += `   📌 Cenário: ${boleto.cenario === 'PAGOU_PROXIMO_MES' ? 'Pagou próximo mês' : 'Pagou mais recente'}\n`;
    mensagem += `   🔗 ID Renegociação: ${boleto.idRenegociacao}\n\n`;
  });
  
  return {
    json: {
      mensagem: mensagem,
      ids: response.boletosRenegociados.map(b => b.idBoleto),
      total: response.resumo.totalRenegociado,
      detalhes: response.boletosRenegociados
    }
  };
}

return {
  json: {
    mensagem: `ℹ️ Nenhum boleto foi renegociado hoje (${response.data}).`,
    ids: [],
    total: 0
  }
};
```

#### Passo 6: Configurar WhatsApp/Email Node

**Para WhatsApp (usando WhatsApp Business API):**
- **Phone Number:** Número do responsável
- **Message:** `{{ $json.mensagem }}`

**Para Email:**
- **To Email:** email@empresa.com
- **Subject:** `Relatório de Renegociações - {{ $now.format('DD/MM/YYYY') }}`
- **Email Type:** Text
- **Text:** `{{ $json.mensagem }}`

### Cenário 2: Webhook Manual (On-Demand)

**Objetivo:** Processar renegociações sob demanda via webhook.

#### Passo 1: Criar Workflow com Webhook

```
[Webhook] → [HTTP Request] → [Code] → [Respond to Webhook]
```

#### Passo 2: Configurar Webhook Node

- **HTTP Method:** POST
- **Path:** `/renegociar-boletos`
- **Response Mode:** Last Node
- **Response Data:** All Entries

#### Passo 3: Configurar HTTP Request

- **Method:** POST
- **URL:** `http://seu-servidor:3000/api/processar-renegociacoes`
- **Body Content Type:** JSON

**Body:**
```json
{
  "data": "={{ $json.body.data || $now.format('DD/MM/YYYY') }}"
}
```

#### Passo 4: Configurar Code Node

```javascript
const response = $input.first().json;

return {
  json: {
    success: response.sucesso,
    message: `Processamento concluído: ${response.resumo.totalRenegociado} boleto(s) renegociado(s)`,
    ids: response.boletosRenegociados?.map(b => b.idBoleto) || [],
    summary: response.resumo,
    details: response.boletosRenegociados || []
  }
};
```

#### Passo 5: Configurar Respond to Webhook

- **Response Body:** `{{ $json }}`

#### Testando o Webhook

Salve e ative o workflow. Você receberá uma URL como:

```
https://seu-n8n.com/webhook/renegociar-boletos
```

Teste com curl:

```bash
curl -X POST https://seu-n8n.com/webhook/renegociar-boletos \
  -H "Content-Type: application/json" \
  -d '{"data":"15/01/2026"}'
```

### Cenário 3: Integração com Sistema Externo

Se você precisa que um sistema externo acione as renegociações:

```
[Sistema Externo] 
    ↓ (webhook call)
[N8N Webhook] 
    ↓
[HTTP Request para sua API]
    ↓
[Process Results]
    ↓
[Return to Sistema Externo]
```

## 💡 Exemplos de Uso

### Exemplo 1: Testar com cURL

```bash
# Processar renegociações de hoje
curl -X POST http://localhost:3000/api/processar-renegociacoes \
  -H "Content-Type: application/json" \
  -d '{}'

# Processar renegociações de uma data específica
curl -X POST http://localhost:3000/api/processar-renegociacoes \
  -H "Content-Type: application/json" \
  -d '{"data":"15/01/2026"}'

# Renegociar um boleto específico
curl -X POST http://localhost:3000/api/renegociar-boleto \
  -H "Content-Type: application/json" \
  -d '{
    "idBoleto": "145367",
    "novaDataVencimento": "31/01/2026"
  }'
```

### Exemplo 2: Testar com JavaScript/Node.js

```javascript
const axios = require('axios');

async function processarRenegociacoes() {
  try {
    const response = await axios.post('http://localhost:3000/api/processar-renegociacoes', {
      data: '15/01/2026'
    });
    
    console.log('Total renegociado:', response.data.resumo.totalRenegociado);
    console.log('IDs:', response.data.boletosRenegociados.map(b => b.idBoleto));
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

processarRenegociacoes();
```

### Exemplo 3: Testar com Python

```python
import requests

url = "http://localhost:3000/api/processar-renegociacoes"
payload = {"data": "15/01/2026"}

response = requests.post(url, json=payload)
data = response.json()

if data['sucesso']:
    print(f"Total renegociado: {data['resumo']['totalRenegociado']}")
    ids = [b['idBoleto'] for b in data['boletosRenegociados']]
    print(f"IDs: {ids}")
```

## 🔍 Troubleshooting

### Problema: Erro "IXC_BASE_URL e IXC_TOKEN devem estar definidos"

**Solução:**
1. Certifique-se de que o arquivo `.env` existe
2. Verifique se as variáveis estão configuradas corretamente
3. Reinicie a aplicação

### Problema: Erro 401 na API IXC

**Solução:**
1. Verifique se o token está em Base64
2. Confirme que o prefixo `Basic ` está presente
3. Teste o token diretamente na API IXC

### Problema: "Cannot find module"

**Solução:**
```bash
# Limpe as dependências e reinstale
rm -rf node_modules
pnpm install
```

### Problema: Testes falhando

**Solução:**
```bash
# Limpe o cache do Jest
pnpm test --clearCache

# Execute novamente
pnpm test
```

### Problema: Porta 3000 já está em uso

**Solução:**
Altere a porta no `.env`:
```env
PORT=3001
```

### Problema: N8N não consegue acessar a API

**Soluções:**

1. **Se API e N8N estão na mesma máquina:**
   - Use `http://localhost:3000`

2. **Se API e N8N estão em máquinas diferentes:**
   - Use o IP público: `http://192.168.1.100:3000`
   - Certifique-se de que a porta está aberta no firewall

3. **Se API está em Docker:**
   - Use `http://host.docker.internal:3000` (Windows/Mac)
   - Ou configure network bridge

4. **Se usando HTTPS:**
   - Configure um certificado SSL
   - Use um proxy reverso (nginx, Caddy)

## 📁 Estrutura do Projeto

```
.
├── src/
│   ├── services/
│   │   ├── __tests__/          # Testes unitários
│   │   │   ├── ixcService.test.ts
│   │   │   └── renegociacaoService.test.ts
│   │   ├── ixcService.ts       # Comunicação com API IXC
│   │   └── renegociacaoService.ts  # Lógica de renegociação
│   ├── types/
│   │   └── index.ts            # Definições TypeScript
│   └── index.ts                # Servidor Express
├── dist/                        # Código compilado (gerado)
├── coverage/                    # Relatórios de teste (gerado)
├── .env                         # Variáveis de ambiente (não versionar)
├── .env.example                 # Exemplo de configuração
├── .eslintrc.js                 # Configuração ESLint
├── .gitignore
├── jest.config.js               # Configuração Jest
├── tsconfig.json                # Configuração TypeScript
├── package.json
└── README.md
```

## 🔐 Segurança

- ⚠️ **Nunca commite o arquivo `.env`** com suas credenciais
- Use variáveis de ambiente em produção
- Mantenha o token IXC seguro
- Configure HTTPS em produção
- Considere usar autenticação na API (API Key, JWT)

## 📊 Monitoramento

Para monitorar a aplicação em produção, considere:

- **PM2** - Gerenciador de processos Node.js
- **Logs** - Winston ou Pino para logging estruturado
- **Métricas** - Prometheus + Grafana
- **Alertas** - Configurar alertas no N8N para falhas

## 🚀 Deploy em Produção

### Usando PM2

```bash
# Instalar PM2
pnpm add -g pm2

# Build da aplicação
pnpm build

# Iniciar com PM2
pm2 start dist/index.js --name renegociacao-boletos

# Salvar configuração
pm2 save

# Configurar para iniciar no boot
pm2 startup
```

### Usando Docker

Crie um `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
```

Build e execute:

```bash
docker build -t renegociacao-boletos .
docker run -p 3000:3000 --env-file .env renegociacao-boletos
```

## 📝 Licença

ISC

## 🤝 Suporte

Em caso de dúvidas:
1. Verifique a seção [Troubleshooting](#-troubleshooting)
2. Revise os logs da aplicação
3. Execute os testes: `pnpm test`
4. Verifique a documentação da API IXC

---
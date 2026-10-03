# BDIA


Sistema web de Base de Conhecimento utilizando IA Generativa, desenvolvido para a disciplina de Sistemas Inteligentes da Universidade CEUMA, no curso de Engenharia de Computação.

O BDIA permite enviar documentos e conectar fontes de dados para realizar análises e responder perguntas em linguagem natural.

A aplicação possui API própria desenvolvida em FastAPI e utiliza o modelo Llama 3.2 1B, executado localmente através do Ollama. Não são utilizadas APIs externas de inteligência artificial, como OpenAI ou Gemini.

## Tecnologias

- **Front-end:** HTML5, CSS3 e JavaScript.
- **Back-end:** Python, FastAPI, Uvicorn, SQLAlchemy, Pandas e JWT.
- **Inteligência Artificial:** Ollama e Llama 3.2 1B.
- **Banco de dados:** MySQL, SQLite e MongoDB.
- **Conectores de banco:** PyMySQL e PyMongo.
- **Processamento de documentos:** pypdf, python-docx, OpenPyXL e xlrd.

BDIA - é B de Beatriz e D de Duda, a dupla da atividade. 

## Comece aqui

Para executar o projeto localmente, são necessários Python 3.12 ou superior e Ollama.

O projeto utiliza MySQL como banco de dados relacional. O SQLite está disponível como fallback para desenvolvimento quando as configurações do MySQL não estão definidas.

O MongoDB é utilizado quando forem cadastradas fontes desse tipo.

---

## Instalação

### Requisitos

Antes de iniciar, instale:

* Python 3.12 ou superior
* Ollama
* MySQL
* MongoDB, caso utilize fontes MongoDB

### 1. Clonar o projeto

```bash
git clone https://github.com/AnnBtz21937/Data-Lens-IA.git

cd Data-Lens-IA
```

### 2. Criar o ambiente virtual

O ambiente virtual deve ser criado dentro da pasta `backend`:

```bash
cd backend

python -m venv .venv
```

### 3. Ativar o ambiente virtual

**Windows CMD:**

```cmd
.venv\Scripts\activate
```

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Linux/macOS:**

```bash
source .venv/bin/activate
```

> **Importante:** mantenha o ambiente virtual ativado enquanto estiver executando o backend.

### 4. Instalar as dependências

Ainda dentro da pasta `backend` e com o ambiente virtual ativado:

```bash
python -m pip install --upgrade pip

python -m pip install -r requirements.txt
```

### 5. Configurar o banco de dados

Crie o arquivo `backend/.env` com as informações de conexão do MySQL:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=datalens
DB_USER=root
DB_PASSWORD=sua_senha
```

> Não compartilhe o arquivo `.env` nem envie suas credenciais para o GitHub.

### 6. Instalar o modelo de IA

O projeto utiliza o **Llama 3.2 1B**, executado localmente através do Ollama.

Baixe o modelo com:

```bash
ollama pull llama3.2:1b
```

Para verificar se o modelo está instalado:

```bash
ollama list
```

O Ollama precisa estar em execução para que o backend consiga utilizar as funcionalidades de IA.

> **Não é necessário manter `ollama run llama3.2:1b` aberto em um terminal separado durante o uso normal do sistema.** O importante é que o serviço do Ollama esteja em execução e que o modelo esteja instalado.

---

## Executar o projeto

### Backend

Abra um terminal na raiz do projeto e entre na pasta `backend`:

```cmd
cd backend
```

Ative o ambiente virtual:

```cmd
.venv\Scripts\activate
```

Com o ambiente virtual ativado, execute o backend:

```cmd
python -m uvicorn app.main:app --reload --port 8000
```

> **Importante:** mantenha este terminal aberto enquanto estiver utilizando o sistema.

A API estará disponível em:

```text
http://localhost:8000
```

Para verificar se a API está funcionando, acesse:

```text
http://localhost:8000/health
```

Resposta esperada:

```json
{"status":"ok"}
```

A documentação interativa da API pode ser acessada em:

```text
http://localhost:8000/docs
```

### Front-end

Abra **outro terminal**, mantendo o backend em execução.

A partir da raiz do projeto, execute:

```cmd
cd front-end
python -m http.server 5500
```

> **Importante:** mantenha este segundo terminal aberto enquanto estiver utilizando o sistema.

Depois, acesse:

```text
http://localhost:5500
```

O front-end utiliza o arquivo `front-end/config.js` para localizar a API do backend.

### Resumo da execução

Para utilizar o BDIA localmente, mantenha:

* **Backend:** ambiente virtual ativado e Uvicorn em execução na porta `8000`;
* **Ollama:** serviço em execução e modelo `llama3.2:1b` instalado;
* **Front-end:** servidor HTTP em execução na porta `5500`.

A estrutura de execução é:

```text
BDIA
├── Backend
│   ├── .venv
│   └── Uvicorn → http://localhost:8000
│
├── Ollama
│   └── Llama 3.2 1B
│
└── Front-end
    └── HTTP Server → http://localhost:5500
```

---


## Visão geral

O projeto é dividido em duas partes principais:

- **Front-end:** interface web desenvolvida com HTML, CSS e JavaScript.
- **Back-end:** API desenvolvida com FastAPI, responsável pelo processamento das fontes, autenticação, gerenciamento de projetos e acesso aos dados.

O frontend se comunica com o backend por meio de requisições HTTP e não acessa diretamente os bancos de dados.

O backend integra processamento de documentos, análise de dados, MySQL, MongoDB e inteligência artificial local como o Ollama e Llama 3.2 1B.

## Fluxo da aplicação

1. O usuário cria uma conta através de `POST /users/`.
2. O login envia e-mail e senha para `POST /auth/login`.
3. A API autentica o usuário e retorna um token JWT. O frontend armazena o token no `localStorage` e o envia nas requisições autenticadas utilizando o cabeçalho `Authorization: Bearer <token>`.
4. Após o login, o frontend consulta `GET /users/me` para obter os dados do usuário autenticado.
5. O frontend consulta `GET /projects/` para carregar os projetos do usuário. Caso não exista nenhum projeto, é criado um projeto inicial através de `POST /projects/`.
6. As fontes associadas ao projeto são carregadas através de `GET /sources/project/{project_id}`.
7. Os arquivos são enviados para a API utilizando `multipart/form-data` através de `POST /sources/{project_id}/upload`.
8. Para consultar uma fonte, o frontend envia a pergunta para `POST /sources/{source_id}/ask`.
9. O backend processa a fonte e utiliza os dados analisados para construir o contexto da pergunta. Quando necessário, esse contexto é enviado ao modelo `Llama 3.2 1B`, executado localmente através do Ollama, para gerar a resposta em linguagem natural.
10. A API retorna a resposta e as informações da análise para o frontend, que apresenta o resultado ao usuário.

As perguntas e respostas realizadas durante a utilização do sistema são armazenadas no banco de dados. Ao abrir ou trocar de projeto, o frontend consulta `GET /projects/{project_id}/history` para recuperar o histórico da conversa e atualizar as informações exibidas na interface.

## Estrutura do backend

```text
backend/app/

    main.py                 inicialização da API, CORS e rotas
    database.py             conexão SQLAlchemy e fallback SQLite local

    models/
        user.py             modelo de usuário
        project.py          modelo de projeto
        source.py           modelo de fonte
        question.py         histórico de perguntas e respostas

    schemas/                modelos de entrada e saída da API

    routes/
        auth.py             login e autenticação JWT
        users.py            criação e consulta do usuário autenticado
        projects.py         criação e listagem de projetos
        source.py           upload, fontes, análise e perguntas
        mysql.py            consulta e perguntas sobre tabelas MySQL

    services/
        analysis.py         estatísticas e relações para CSV e Excel
        documents.py        leitura e processamento de documentos
        ai.py               integração com Ollama e criação de prompts
        mysql_data.py       leitura e preparação de dados do MySQL
```

## Formatos e fontes aceitos

* **PDF**: texto extraído com `pypdf`.
* **DOCX**: parágrafos e tabelas extraídos com `python-docx`.
* **TXT**: leitura com tentativas de UTF-8, CP1252 e Latin-1.
* **CSV**: leitura e detecção de separador e codificação com Pandas.
* **XLSX** e **XLS**: leitura com Pandas, OpenPyXL e xlrd.
* **MySQL**: conexão com o banco utilizando SQLAlchemy e PyMySQL.
* **MongoDB**: consulta de coleções e filtros JSON utilizando PyMongo.

Arquivos `.doc` antigos não são processados diretamente. Nesse caso, o arquivo deve ser convertido para `.docx` antes do upload.

### MySQL

As tabelas do MySQL podem ser listadas e consultadas pela API. O sistema também permite realizar perguntas em linguagem natural sobre uma tabela selecionada.

Principais operações:

```text
GET  /mysql/tables
GET  /mysql/tables/{table_name}
POST /mysql/ask
```

Na consulta por linguagem natural, o backend prepara os dados da tabela e utiliza o contexto obtido para gerar a resposta.

### MongoDB

As fontes MongoDB utilizam uma URL com o banco de dados e uma consulta informando a coleção.

Exemplo:

```text
mongodb://localhost:27017/meu_banco
```

Consulta com filtro:

```text
clientes?{"status":"ativo"}
```

Sem filtro, informe apenas o nome da coleção:

```text
clientes
```

O backend limita a consulta a 1.000 registros e converte o campo `_id` para texto.

Fontes MySQL e MongoDB são utilizadas diretamente como fontes de dados, sem necessidade de upload de arquivo.

## Como as respostas são produzidas

O sistema utiliza os dados disponíveis nas fontes para construir o contexto de cada pergunta e evita gerar informações que não estejam presentes nos dados analisados.

- Em documentos de texto, o sistema identifica os trechos mais relevantes para a pergunta.
- Em tabelas, o sistema analisa a estrutura, registros, colunas e estatísticas disponíveis.
- Perguntas gerais podem utilizar os insights calculados durante a análise dos dados, incluindo relações entre categorias e informações sobre a qualidade dos dados.
- Quando a informação solicitada não está disponível na fonte analisada, o sistema informa que não encontrou dados suficientes para responder.

Quando uma resposta em linguagem natural é necessária, o backend utiliza o Ollama, executado localmente em `http://localhost:11434`, com o modelo `llama3.2:1b`.

A análise estrutural dos dados pode ser realizada pelo backend independentemente do modelo de linguagem. Entretanto, as funcionalidades que dependem da geração de respostas em linguagem natural exigem que o Ollama esteja em execução.

## Rotas principais

| Método | Rota | Função |
| --- | --- | --- |
| `POST` | `/users/` | cria uma conta |
| `GET` | `/users/me` | retorna o usuário autenticado |
| `POST` | `/auth/login` | autentica com OAuth2 form e retorna JWT |
| `GET` | `/projects/` | lista projetos do usuário |
| `POST` | `/projects/` | cria um projeto |
| `GET` | `/sources/project/{project_id}` | lista fontes do projeto |
| `POST` | `/sources/{project_id}/upload` | envia uma fonte |
| `POST` | `/sources/{source_id}/analyze` | executa análise explícita |
| `POST` | `/sources/{source_id}/ask` | responde uma pergunta sobre a fonte |
| `GET` | `/projects/{project_id}/history` | carrega o histórico do projeto |
| `GET` | `/mysql/tables` | lista as tabelas disponíveis no MySQL |
| `GET` | `/mysql/tables/{table_name}` | consulta uma tabela MySQL |
| `POST` | `/mysql/ask` | responde uma pergunta sobre uma tabela MySQL |
| `GET` | `/mongodb/collections` | lista as coleções do MongoDB |
| `GET` | `/mongodb/collections/{collection_name}` | lista campos e documentos de uma coleção |
| `POST` | `/mongodb/ask` | responde uma pergunta usando documentos da coleção |
| `GET` | `/health` | verifica se a API está funcionando |

As rotas MySQL e MongoDB são somente de leitura: `GET` lista/consulta dados e `POST` processa perguntas. Não há `PUT` ou `DELETE`, pois essas APIs não alteram os bancos externos. Todas exigem token JWT.

Para habilitar os endpoints MongoDB, configure `MONGODB_URL` no `backend/.env`, incluindo o banco na URL, por exemplo `mongodb://localhost:27017/meu_banco`. Opcionalmente, use `MONGODB_DATABASE` para informar o banco separadamente. O resumo retorna até 1.000 documentos; a IA considera até 50 documentos por pergunta.

## Diagnóstico rápido

- **Tela sem estilo:** confirme que o frontend foi iniciado dentro de `front-end` e verifique se `http://localhost:5500/style.css` retorna `200`.

- **Erro de conexão com a API:** confirme se o backend está em execução em `http://localhost:8000` e teste `http://localhost:8000/health`.

- **Erro no MySQL:** confirme se o servidor MySQL está em execução e se as variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` estão configuradas corretamente no arquivo `backend/.env`.

- **Erro nas respostas de IA:** confirme se o Ollama está instalado, em execução e se o modelo `llama3.2:1b` está disponível. Para verificar, execute `ollama list`.

- **PDF sem resposta:** PDFs digitalizados como imagem podem exigir OCR. O processamento atual trabalha com texto nativo do PDF.

- **Arquivo `.doc`:** converta o arquivo para `.docx` antes do envio.

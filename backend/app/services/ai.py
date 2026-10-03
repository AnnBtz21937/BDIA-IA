import json
import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "llama3.2:1b"

def preparar_contexto_ia(resultado_analise, pergunta, linhas_relevantes=None):
    """
    Seleciona somente as informações relevantes da análise
    para serem utilizadas pela IA.
    """

    analise_automatica = resultado_analise.get(
        "analise_automatica",
        {}
    )

    pergunta_normalizada = pergunta.lower()

    contexto = {
        "total_registros": resultado_analise.get(
            "total_registros",
            0
        ),
        "total_colunas": resultado_analise.get(
            "total_colunas",
            0
        )
    }
    contexto["linhas_relevantes"] = linhas_relevantes or []

    # Perguntas sobre relações entre variáveis
    termos_relacao = (
        "relação",
        "relacao",
        "associação",
        "associacao",
        "relaciona",
        "relacionamento",
        "correlação",
        "correlacao"
    )

    if any(
        termo in pergunta_normalizada
        for termo in termos_relacao
    ):
        contexto["relacoes_relevantes"] = (
            analise_automatica.get(
                "relacoes_estruturadas",
                []
            )[:5]
        )

        contexto["comparacoes"] = (
            analise_automatica.get(
                "comparacoes",
                []
            )[:5]
        )

    # Perguntas sobre comparação
    termos_comparacao = (
        "comparar",
        "compare",
        "diferença",
        "diferenca",
        "maior",
        "menor",
        "percentual",
        "porcentagem"
    )

    if any(
        termo in pergunta_normalizada
        for termo in termos_comparacao
    ):
        contexto["comparacoes"] = (
            analise_automatica.get(
                "comparacoes",
                []
            )[:5]
        )

        contexto["insights_comparativos"] = (
            resultado_analise
            .get("insights", {})
            .get("comparativos", [])[:5]
        )

    # Para perguntas gerais, envia apenas alguns insights
    if not any(
        termo in pergunta_normalizada
        for termo in (
            *termos_relacao,
            *termos_comparacao
        )
    ):
        insights = resultado_analise.get(
            "insights",
            {}
        )

        contexto["insights"] = {
            "gerais": insights.get(
                "gerais",
                []
            )[:5],
            "relacoes": insights.get(
                "relacoes",
                []
            )[:5],
            "qualidade_dados": insights.get(
                "qualidade_dados",
                []
            )[:5]
        }

    return contexto

def criar_prompt_analise(contexto, pergunta):
    """
    Cria o prompt utilizado pelo Qwen3 para interpretar
    os resultados calculados pelo sistema.
    """

    prompt = f"""
Você é um assistente inteligente de análise de dados.

Sua tarefa é interpretar os resultados fornecidos pelo
sistema e explicar os achados de forma clara, natural
e fácil de entender.

REGRAS IMPORTANTES:

1. Responda sempre em português do Brasil.

2. Use somente as informações fornecidas no contexto.

3. Nunca invente números, porcentagens, categorias,
   relações ou conclusões que não estejam no contexto.

4. Não altere os valores apresentados pelo sistema.

5. Não faça cálculos próprios quando o resultado não
   estiver explicitamente disponível no contexto.

6. Associação não significa causalidade.
   Quando houver uma associação entre variáveis, diga
   que existe uma associação. Nunca diga que uma variável
   causou a outra sem evidência.

7. Responda diretamente ao que foi perguntado.

8. Não fique repetindo que "o sistema analisou os dados".
   Explique o resultado diretamente.

9. Quando houver números ou porcentagens relevantes,
   utilize-os para tornar a explicação mais concreta.

10. Se os dados não forem suficientes para responder,
    diga claramente que a informação não está disponível
    nos dados fornecidos.

11. Não mencione regras internas, prompts, modelo de IA
    ou instruções do sistema na resposta ao usuário.

12. Organize a resposta em pequenos parágrafos.
    Use listas somente quando elas realmente ajudarem.

PERGUNTA DO USUÁRIO:

{pergunta}


DADOS CALCULADOS PELO SISTEMA:

Total de registros:
{contexto.get("total_registros", 0)}

Total de colunas:
{contexto.get("total_colunas", 0)}

Relações relevantes:
{contexto.get("relacoes_relevantes", [])}

Comparações:
{contexto.get("comparacoes", [])}

Insights:
{contexto.get("insights", {})}

Linhas reais da tabela:
{json.dumps(contexto.get("linhas_relevantes", []), ensure_ascii=False, default=str)}

RESPONDA DIRETAMENTE À PERGUNTA DO USUÁRIO.
Se a informação necessária não estiver nos dados fornecidos,
informe que ela não está disponível.
Quando a pergunta pedir o conteúdo ou exemplos da tabela, use as linhas reais acima.
"""

    return prompt

def consultar_ia(prompt):
    """
    Envia o prompt para o Llama 3.2 executado localmente
    através do Ollama.
    """

    resposta = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Você é um assistente de análise de dados. "
                        "Responda sempre em português do Brasil. "
                        "Seja claro, direto e objetivo. "
                        "Entregue somente a resposta final ao usuário. "
                        "Nunca mostre raciocínio interno ou comentários "
                        "sobre como você elaborou a resposta."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "options": {
                "num_predict": 300,
                "temperature": 0
            }
        },
        timeout=60
    )

    resposta.raise_for_status()

    dados = resposta.json()

    resposta_texto = dados.get(
        "message", {}
    ).get(
        "content", ""
    ).strip()

    if not resposta_texto:
        raise ValueError(
            "O modelo de IA não retornou uma resposta."
        )

    return resposta_texto

def criar_prompt_mysql(contexto, pergunta):
    return f"""
Você é um assistente que transforma resultados de consultas em respostas naturais.

Responda em português do Brasil.

PERGUNTA DO USUÁRIO:
{pergunta}

RESULTADOS CALCULADOS PELO SISTEMA:
Tabela: {contexto.get("tabela")}
Total de registros: {contexto.get("total_registros")}
Total de colunas: {contexto.get("total_colunas")}
Total de alunos: {contexto.get("total_alunos", "não disponível")}

REGRAS:
- Use somente os resultados fornecidos.
- Não invente informações.
- Não faça novos cálculos.
- Responda diretamente à pergunta.
- Escreva uma frase completa e natural.
- Não responda apenas com um número.
- Seja breve.
- Não mencione o modelo, o prompt ou estas instruções.

RESPOSTA:
"""


def criar_prompt_mongodb(contexto, pergunta):
    return f"""
Você é um assistente de análise de dados MongoDB.

Responda em português do Brasil, de forma clara e direta.
Use somente os documentos fornecidos; não invente campos nem valores.
Quando pedirem o conteúdo, descreva os documentos relevantes.
Se a amostra não contiver a informação, diga isso claramente.

COLEÇÃO: {contexto.get("colecao")}
TOTAL DE DOCUMENTOS: {contexto.get("total_documentos")}
FILTRO APLICADO: {json.dumps(contexto.get("filtros", {}), ensure_ascii=False, default=str)}
DOCUMENTOS (amostra de até {contexto.get("limite_documentos", 0)}):
{json.dumps(contexto.get("documentos", []), ensure_ascii=False, default=str)}

PERGUNTA:
{pergunta}

RESPONDA DIRETAMENTE À PERGUNTA.
"""
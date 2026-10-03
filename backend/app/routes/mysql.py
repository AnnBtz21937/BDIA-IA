from fastapi import APIRouter, Depends, HTTPException

from app.services.mysql_data import (
    listar_tabelas_mysql,
    resumo_tabela_mysql,
    contexto_mysql_para_ia
)

from app.services.ai import criar_prompt_mysql, consultar_ia
from app.routes.auth import get_current_user

router = APIRouter(
    prefix="/mysql",
    tags=["MySQL"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/tables")
def get_mysql_tables():
    try:
        return {
            "tables": listar_tabelas_mysql()
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar tabelas do MySQL: {str(error)}"
        ) from error


@router.get("/tables/{table_name}")
def get_mysql_table(table_name: str):
    try:
        return resumo_tabela_mysql(table_name)
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao consultar tabela MySQL: {str(error)}"
        ) from error

@router.post("/ask")
def ask_mysql(question: dict):
    question_text = str(
        question.get("question", "")
    ).strip()

    table_name = str(
        question.get("table", "")
    ).strip()

    if not question_text:
        raise HTTPException(
            status_code=400,
            detail="Digite uma pergunta."
        )

    if not table_name:
        raise HTTPException(
            status_code=400,
            detail="Informe a tabela."
        )

    try:
        contexto = contexto_mysql_para_ia(
            table_name
        )

        prompt = criar_prompt_mysql(
            contexto,
            question_text
        )

        resposta = consultar_ia(prompt)

        return {
            "table": table_name,
            "question": question_text,
            "answer": resposta
        }

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao consultar MySQL: {str(error)}"
        ) from error
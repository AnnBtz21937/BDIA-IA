from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.routes.auth import get_current_user
from app.services.ai import consultar_ia, criar_prompt_mongodb
from app.services.mongodb_data import (
    MongoCollectionNotFoundError,
    MongoConfigurationError,
    contexto_colecao_mongodb,
    listar_colecoes_mongodb,
    resumo_colecao_mongodb
)


router = APIRouter(
    prefix="/mongodb",
    tags=["MongoDB"],
    dependencies=[Depends(get_current_user)]
)


class MongoQuestion(BaseModel):
    collection: str = Field(min_length=1)
    question: str = Field(min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)


def _raise_mongodb_error(error: Exception):
    if isinstance(error, MongoConfigurationError):
        raise HTTPException(status_code=503, detail=str(error)) from error
    if isinstance(error, MongoCollectionNotFoundError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    raise HTTPException(
        status_code=502,
        detail=f"Erro ao consultar MongoDB: {error}"
    ) from error


@router.get("/collections")
def get_mongodb_collections():
    try:
        return {"collections": listar_colecoes_mongodb()}
    except Exception as error:
        _raise_mongodb_error(error)


@router.get("/collections/{collection_name}")
def get_mongodb_collection(collection_name: str):
    try:
        return resumo_colecao_mongodb(collection_name)
    except Exception as error:
        _raise_mongodb_error(error)


@router.post("/ask")
def ask_mongodb(request: MongoQuestion):
    collection_name = request.collection.strip()
    question = request.question.strip()
    if not collection_name:
        raise HTTPException(status_code=400, detail="Informe a coleção.")
    if not question:
        raise HTTPException(status_code=400, detail="Digite uma pergunta.")

    try:
        context = contexto_colecao_mongodb(
            collection_name,
            request.filters
        )
        prompt = criar_prompt_mongodb(context, question)
        answer = consultar_ia(prompt)
        return {
            "collection": collection_name,
            "question": question,
            "documents_considered": len(context["documentos"]),
            "answer": answer
        }
    except (MongoConfigurationError, MongoCollectionNotFoundError) as error:
        _raise_mongodb_error(error)
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao consultar MongoDB ou gerar resposta: {error}"
        ) from error
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
import shutil
import json
import re
import urllib.parse
import uuid

from app.database import get_db
from app.models.source import Source
from app.models.question import Question
from app.schemas.source import SourceCreate
from app.routes.auth import get_current_user
from app.services.documents import (
    answer_question,
    read_document,
    SUPPORTED_EXTENSIONS
)

router = APIRouter(prefix="/sources", tags=["Sources"])


def _is_database_source(source: Source) -> bool:
    return bool(source.path and source.path.startswith("database:"))


def _normalize_mysql_query(query: str) -> str:
    query = query.strip()
    identifier = r"[A-Za-z_][A-Za-z0-9_$]*"

    if re.fullmatch(rf"{identifier}(?:\.{identifier})*", query):
        table_name = ".".join(f"`{part}`" for part in query.split("."))
        return f"SELECT * FROM {table_name}"

    statement = query[:-1].rstrip() if query.endswith(";") else query
    if ";" in statement:
        raise ValueError("Informe apenas uma consulta por vez.")
    if not re.match(r"(?is)^SELECT\b", statement):
        raise ValueError(
            "Informe o nome da tabela ou uma consulta iniciada por SELECT."
        )

    return statement


def _normalize_mysql_url(connection_url: str):
    from sqlalchemy.engine import make_url

    url = make_url(connection_url)
    if url.drivername in {"mysql", "mysql+mysqldb"}:
        return url.set(drivername="mysql+pymysql")
    return url


def _database_rows(source_type: str, connection_url: str, query: str):
    if source_type == "mysql":
        from sqlalchemy import create_engine, text

        query = _normalize_mysql_query(query)
        engine = create_engine(
            _normalize_mysql_url(connection_url),
            pool_pre_ping=True
        )
        with engine.connect() as connection:
            result = connection.execute(text(query))
            return [dict(row._mapping) for row in result]

    if source_type == "mongodb":
        from pymongo import MongoClient

        parsed = urllib.parse.urlparse(connection_url)
        database_name = parsed.path.strip("/")
        if not database_name:
            raise ValueError("A URL do MongoDB precisa informar o banco na URL.")

        client = MongoClient(connection_url, serverSelectionTimeoutMS=5000)
        try:
            database = client[database_name]
            collection_name, separator, filter_json = query.partition("?")
            collection_name = collection_name.strip()
            if not collection_name:
                raise ValueError(
                    "A consulta do MongoDB precisa informar a coleção."
                )

            filters = {}
            if separator:
                try:
                    filters = json.loads(filter_json)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        "O filtro do MongoDB precisa ser um JSON válido."
                    ) from error

                if not isinstance(filters, dict):
                    raise ValueError(
                        "O filtro do MongoDB precisa ser um objeto JSON."
                    )

            collection = database[collection_name]
            return [
                {key: str(value) if key == "_id" else value for key, value in row.items()}
                for row in collection.find(filters).limit(1000)
            ]
        finally:
            client.close()

    raise ValueError("Banco de dados não suportado.")


@router.get("/project/{project_id}")
def get_project_sources(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Source).filter(Source.project_id == project_id).all()


@router.post("/{project_id}")
def create_source(
    project_id: int,
    source: SourceCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_source = Source(
        name=source.name,
        type=source.type,
        path=source.path,
        project_id=project_id
    )

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return new_source

@router.post("/{project_id}/upload")
def upload_source(
    project_id: int,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    allowed_extensions = SUPPORTED_EXTENSIONS

    file_extension = os.path.splitext(file.filename)[1].lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Formato de arquivo não permitido."
        )

    upload_directory = "uploads"

    os.makedirs(upload_directory, exist_ok=True)

    safe_filename = os.path.basename(file.filename)
    stored_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(
        upload_directory,
        stored_filename
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_source = Source(
        name=safe_filename,
        type=file_extension.replace(".", ""),
        path=file_path,
        project_id=project_id
    )

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return new_source


@router.post("/{project_id}/database")
def create_database_source(
    project_id: int,
    source: dict,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source_type = str(source.get("type", "")).lower()
    connection_url = str(source.get("connection_url", "")).strip()
    query = str(source.get("query", "")).strip()
    name = str(source.get("name", "Fonte de banco")).strip()

    if source_type not in {"mysql", "mongodb"}:
        raise HTTPException(status_code=400, detail="Escolha MySQL ou MongoDB.")
    if not connection_url or not query:
        raise HTTPException(status_code=400, detail="Informe a conexão e a consulta.")

    try:
        rows = _database_rows(source_type, connection_url, query)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Não foi possível consultar o banco: {error}") from error

    if not rows:
        raise HTTPException(status_code=400, detail="A consulta não retornou registros.")

    upload_directory = "uploads"
    os.makedirs(upload_directory, exist_ok=True)
    snapshot_path = os.path.join(
        upload_directory,
        f"{uuid.uuid4().hex}.csv"
    )

    try:
        import pandas as pd

        pd.DataFrame(rows).to_csv(snapshot_path, index=False)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível salvar os dados consultados: {error}"
        ) from error

    new_source = Source(
        name=name,
        type=source_type,
        path=snapshot_path,
        project_id=project_id
    )
    db.add(new_source)
    db.commit()
    db.refresh(new_source)
    return {
        "id": new_source.id,
        "name": new_source.name,
        "type": new_source.type,
        "project_id": new_source.project_id,
        "rows": rows
    }


@router.delete("/{source_id}")
def delete_source(
    source_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = db.query(Source).filter(Source.id == source_id).first()

    if not source:
        raise HTTPException(status_code=404, detail="Fonte não encontrada.")

    db.query(Question).filter(Question.source_id == source_id).delete(
        synchronize_session=False
    )
    db.delete(source)
    db.commit()
    return {"message": "Fonte excluída."}


@router.post("/{source_id}/ask")
def ask_source(
    source_id: int,
    question: dict,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = db.query(Source).filter(Source.id == source_id).first()

    if not source:
        raise HTTPException(status_code=404, detail="Fonte de dados não encontrada.")

    question_text = str(question.get("question", "")).strip()
    if not question_text:
        raise HTTPException(status_code=400, detail="Digite uma pergunta.")

    if not source.path or (
        not _is_database_source(source) and not os.path.exists(source.path)
    ):
        raise HTTPException(status_code=404, detail="Arquivo da fonte não encontrado.")

    try:
        result = answer_question(source.path, source.name, question_text)
        history_item = Question(
            question=question_text,
            answer=result["answer"],
            user_id=user_id,
            project_id=source.project_id,
            source_id=source.id
        )
        db.add(history_item)
        db.commit()
        return result
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao responder a pergunta: {str(error)}"
        ) from error

@router.post("/{source_id}/analyze")
def analyze_source(
    source_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = db.query(Source).filter(
        Source.id == source_id
    ).first()

    if not source:
        raise HTTPException(
            status_code=404,
            detail="Fonte de dados não encontrada."
        )

    if not source.path:
        raise HTTPException(
            status_code=400,
            detail="A fonte não possui um arquivo associado."
        )

    if not _is_database_source(source) and not os.path.exists(source.path):
        raise HTTPException(
            status_code=404,
            detail="Arquivo da fonte não encontrado."
        )

    try:
        resultado = read_document(source.path)["analysis"]

        return {
            "source_id": source.id,
            "source_name": source.name,
            "analysis": resultado
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao analisar a fonte: {str(e)}"
        )
import os
from datetime import date, datetime
from urllib.parse import urlparse

from bson import ObjectId
from pymongo import MongoClient


MAX_DOCUMENTS = 1000
AI_DOCUMENT_LIMIT = 50


class MongoConfigurationError(Exception):
    pass


class MongoCollectionNotFoundError(Exception):
    pass


def _connect():
    connection_url = os.getenv("MONGODB_URL", "").strip()
    if not connection_url:
        raise MongoConfigurationError(
            "Configure MONGODB_URL no ambiente do backend."
        )

    parsed_url = urlparse(connection_url)
    database_name = os.getenv("MONGODB_DATABASE", "").strip()
    database_name = database_name or parsed_url.path.strip("/").split("/")[0]
    if not database_name:
        raise MongoConfigurationError(
            "Informe o banco na URL MongoDB ou configure MONGODB_DATABASE."
        )

    client = MongoClient(connection_url, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except Exception:
        client.close()
        raise

    return client, client[database_name]


def _json_safe(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def listar_colecoes_mongodb():
    client, database = _connect()
    try:
        return database.list_collection_names()
    finally:
        client.close()


def resumo_colecao_mongodb(collection_name: str):
    client, database = _connect()
    try:
        if collection_name not in database.list_collection_names():
            raise MongoCollectionNotFoundError("Coleção não encontrada.")

        collection = database[collection_name]
        total_documents = collection.count_documents({})
        documents = [
            _json_safe(document)
            for document in collection.find({}).limit(MAX_DOCUMENTS)
        ]
        columns = sorted({
            key
            for document in documents
            for key in document
        })

        return {
            "colecao": collection_name,
            "total_documentos": total_documents,
            "total_campos": len(columns),
            "campos": columns,
            "dados": documents,
            "limite_aplicado": total_documents > MAX_DOCUMENTS
        }
    finally:
        client.close()


def contexto_colecao_mongodb(collection_name: str, filters: dict):
    client, database = _connect()
    try:
        if collection_name not in database.list_collection_names():
            raise MongoCollectionNotFoundError("Coleção não encontrada.")

        collection = database[collection_name]
        documents = [
            _json_safe(document)
            for document in collection.find(filters).limit(AI_DOCUMENT_LIMIT)
        ]
        return {
            "colecao": collection_name,
            "total_documentos": collection.count_documents(filters),
            "filtros": filters,
            "limite_documentos": AI_DOCUMENT_LIMIT,
            "documentos": documents
        }
    finally:
        client.close()
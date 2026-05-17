import os
from dataclasses import dataclass
from typing import Protocol

from app.config import (
    R2_ACCESS_KEY_ID,
    R2_BUCKET,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
    STORAGE_PROVIDER,
)


class StorageProvider(Protocol):
    provider_name: str

    def write_bytes(self, *, key: str, data: bytes, content_type: str) -> str:
        ...

    def read_bytes(self, *, object_ref: str) -> bytes:
        ...

    def delete(self, *, object_ref: str) -> None:
        ...

    def exists(self, *, object_ref: str) -> bool:
        ...


@dataclass
class LocalStorageProvider:
    provider_name: str = "local"

    def write_bytes(self, *, key: str, data: bytes, content_type: str) -> str:
        folder = os.path.dirname(key)
        if folder:
            os.makedirs(folder, exist_ok=True)
        with open(key, "wb") as out:
            out.write(data)
        return key

    def read_bytes(self, *, object_ref: str) -> bytes:
        with open(object_ref, "rb") as f:
            return f.read()

    def delete(self, *, object_ref: str) -> None:
        if os.path.exists(object_ref):
            os.remove(object_ref)

    def exists(self, *, object_ref: str) -> bool:
        return os.path.exists(object_ref)


@dataclass
class R2StorageProvider:
    provider_name: str = "r2"

    def __post_init__(self):
        if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY or not R2_BUCKET:
            raise RuntimeError("R2 credentials/bucket are not fully configured")
        if not R2_ENDPOINT:
            raise RuntimeError("R2_ENDPOINT is not configured")
        try:
            import boto3  # type: ignore
        except ImportError as exc:
            raise RuntimeError("boto3 is required for R2 storage") from exc
        self._client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name=R2_REGION or "auto",
        )

    def write_bytes(self, *, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def read_bytes(self, *, object_ref: str) -> bytes:
        result = self._client.get_object(Bucket=R2_BUCKET, Key=object_ref)
        body = result["Body"]
        return body.read()

    def delete(self, *, object_ref: str) -> None:
        self._client.delete_object(Bucket=R2_BUCKET, Key=object_ref)

    def exists(self, *, object_ref: str) -> bool:
        try:
            self._client.head_object(Bucket=R2_BUCKET, Key=object_ref)
            return True
        except Exception:
            return False


def get_storage_provider() -> StorageProvider:
    if STORAGE_PROVIDER == "r2":
        return R2StorageProvider()
    return LocalStorageProvider()


def get_storage_provider_by_name(provider_name: str | None) -> StorageProvider:
    if (provider_name or "local").lower() == "r2":
        return R2StorageProvider()
    return LocalStorageProvider()

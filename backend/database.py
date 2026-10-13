
import mysql.connector
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Aiven CA certificate file
CA_CERT = BASE_DIR / "aiven-ca.pem"

# Create certificate file from Render environment variable
cert_content = os.getenv("AIVEN_CA_CERT")

if cert_content:
    CA_CERT.write_text(
        cert_content.strip() + "\n",
        encoding="utf-8"
    )


def get_db_connection():
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "3306")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")

    if not db_host:
        raise ValueError("DB_HOST environment variable is missing")

    if not db_user:
        raise ValueError("DB_USER environment variable is missing")

    if not db_name:
        raise ValueError("DB_NAME environment variable is missing")

    if not db_port.isdigit():
        raise ValueError("DB_PORT must contain a numeric port number")

    if not CA_CERT.is_file():
        raise FileNotFoundError(
            f"CA certificate not found: {CA_CERT}"
        )

    return mysql.connector.connect(
        host=db_host,
        port=int(db_port),
        user=db_user,
        password=db_password,
        database=db_name,
        ssl_ca=str(CA_CERT),
        ssl_verify_cert=True,
        ssl_verify_identity=True,
        connection_timeout=15,
        use_pure=True
    )

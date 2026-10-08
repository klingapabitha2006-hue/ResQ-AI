import mysql.connector
from dotenv import load_dotenv
import os
from pathlib import Path

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# Aiven SSL certificate
CA_CERT = BASE_DIR / "aiven-ca.pem"

# Render uses AIVEN_CA_CERT environment variable
if os.getenv("AIVEN_CA_CERT"):
    CA_CERT.write_text(
        os.getenv("AIVEN_CA_CERT"),
        encoding="utf-8"
    )


def get_db_connection():

    return mysql.connector.connect(

        host=os.getenv("DB_HOST"),

        port=int(
            os.getenv("DB_PORT", "3306")
        ),

        user=os.getenv("DB_USER"),

        password=os.getenv("DB_PASSWORD"),

        database=os.getenv("DB_NAME"),

        ssl_ca=str(CA_CERT),

        ssl_verify_cert=True,

        ssl_verify_identity=True,

        use_pure=True

    )
# fAInd It - Backend Configuration

import os
from datetime import timedelta

class settings:
    # Database
    POSTGRES_DSN = os.getenv(
        "POSTGRES_DSN",
        "postgresql://fainit_user:your_secure_password@localhost:5432/fainit"
    )

    # Authentication
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkeychangeverysecret")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    # API
    VITE_API_BASE_URL = os.getenv("VITE_API_BASE_URL", "http://localhost:5173")
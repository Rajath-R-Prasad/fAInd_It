"""fAInd It - Backend API Application"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import (
    create_engine,
    inspect,
    text,
    Column,
    String,
    Boolean,
    DateTime,
    Text,
    UUID,
    Integer,
    LargeBinary,
    JSON,
    ForeignKey,
    Index,
    ARRAY,
    Float,
)
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
import uvicorn

from passlib.context import CryptContext
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from uuid import UUID as PyUUID, uuid4
from dotenv import load_dotenv

from app.services.embedding_service import embed_image_data, embed_report_text
from app.services.evaluation_service import (
    EvaluationError,
    evaluation_config,
    run_evaluation,
)
from app.services.matching_service import SCORING_VERSION, rank_candidates
from app.services.metadata_service import metadata_similarity

load_dotenv()

logger = logging.getLogger("faind-it")

MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


# --- Database Configuration ---
DATABASE_URL = os.getenv(
    "POSTGRES_DSN",
    os.getenv("DATABASE_URL", "postgresql://fainit_user:your_secure_password@localhost:5432/fainit")
)

try:
    database_url = make_url(DATABASE_URL)
    if database_url.drivername in {
        "postgres",
        "postgresql",
        "postgresql+psycopg2",
    }:
        database_url = database_url.set(drivername="postgresql+psycopg")

    engine = create_engine(
        database_url,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
except Exception as e:
    print(f"Warning: DB config issue: {e}")
    # Fallback to sqlite for local dev if postgres unavailable
    engine = create_engine("sqlite:///./app.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_schema() -> None:
    """Apply small additive schema upgrades for existing local databases.

    This is a temporary bridge until Alembic migrations are added. New
    databases are created correctly by Base.metadata.create_all().
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    columns = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in tables
    }

    additions = [
        ("users", "mobile_number", "VARCHAR(20)"),
        ("reports", "updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
        ("reports", "status", "VARCHAR(20) NOT NULL DEFAULT 'OPEN'"),
        ("reports", "moderation_status", "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'"),
        ("claims", "message", "TEXT NOT NULL DEFAULT ''"),
        ("claims", "updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
        ("claims", "reviewed_at", "TIMESTAMP"),
    ]

    for table, column, definition in additions:
        if table not in tables or column in columns.get(table, set()):
            continue
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                )
            logger.info("Added missing column %s.%s", table, column)
        except Exception:
            logger.exception("Could not add column %s.%s", table, column)


# --- SQLAlchemy Models ---

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    mobile_number = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    reports = relationship("Report", back_populates="owner")
    claims = relationship(
        "Claim",
        back_populates="claimant",
        foreign_keys="Claim.claimant_id",
    )


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    type = Column(String(10), nullable=False)  # "LOST" or "FOUND"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    color = Column(String(50), nullable=True)
    location = Column(String(500), nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="reports")
    image_record = relationship(
        "ReportImage",
        back_populates="report",
        uselist=False,
        cascade="all, delete-orphan",
    )

    image_embedding = Column("image_embedding", ARRAY(Float), nullable=True)
    text_embedding = Column("text_embedding", ARRAY(Float), nullable=True)

    category_similarity = Column(Float, nullable=True)
    color_similarity = Column(Float, nullable=True)
    location_similarity = Column(Float, nullable=True)
    date_similarity = Column(Float, nullable=True)

    final_score = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True)
    status = Column(String(20), nullable=False, default="OPEN")  # OPEN / MATCHED / CLOSED
    moderation_status = Column(
        String(20), nullable=False, default="ACTIVE"
    )  # ACTIVE / FLAGGED / REMOVED

    __table_args__ = (
        Index("ix_reports_owner_id", "owner_id"),
        Index("ix_reports_type", "type"),
        Index("ix_reports_category", "category"),
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "color": self.color,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "status": self.status or "OPEN",
            "moderation_status": self.moderation_status or "ACTIVE",
            "image_url": f"/uploads/{self.id}" if self.id else None,
            "owner_id": str(self.owner_id) if self.owner_id else None,
        }


class ReportImage(Base):
    __tablename__ = "report_images"

    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    content_type = Column(String(50), nullable=False)
    image_data = Column(LargeBinary, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )

    report = relationship("Report", back_populates="image_record")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    status = Column(
        String(20), nullable=False, default="PENDING"
    )  # PENDING / ACCEPTED / REJECTED
    message = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False)
    claimant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reported_owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    report = relationship("Report", foreign_keys=[report_id])
    claimant = relationship("User", foreign_keys=[claimant_id])
    reported_owner = relationship("User", foreign_keys=[reported_owner_id])


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    run_at = Column(DateTime(timezone=True), nullable=True)
    scoring_version = Column(String(50), nullable=True)
    top_k = Column(Integer, nullable=True)
    dataset_name = Column(String(255), nullable=True)
    dataset_version = Column(String(50), nullable=True)
    query_count = Column(Integer, nullable=True)
    candidate_count = Column(Integer, nullable=True)
    results = Column(JSON, nullable=False)

    __table_args__ = (Index("ix_evaluation_runs_created_at", "created_at"),)


# --- Authentication ---

pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded = jwt.encode(to_encode, os.getenv("SECRET_KEY", "supersecretkeychangeverysecret"), algorithm=os.getenv("ALGORITHM", "HS256"))
    return encoded


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY", "supersecretkeychangeverysecret"), algorithms=[os.getenv("ALGORITHM", "HS256")])
        return payload
    except JWTError:
        return None


def get_db() -> Session:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == PyUUID(user_id)).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user


def get_current_active_superuser(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not a superuser")
    return current_user


def save_report_image(db: Session, report: Report, image: UploadFile, image_data: bytes) -> None:
    """Store or replace a report image directly in PostgreSQL."""
    content_type = image.content_type or "application/octet-stream"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type. Use JPEG, PNG, or WebP.")

    record = report.image_record
    if record is None:
        record = ReportImage(report=report)

    record.content_type = content_type
    record.image_data = image_data
    db.add(record)


def generate_embeddings_for_report(report: Report) -> dict:
    """Generate and assign embeddings, keeping the report if inference fails."""
    result = {"image": "skipped", "text": "skipped", "errors": []}

    image_record = report.image_record
    if image_record and image_record.image_data:
        try:
            report.image_embedding = embed_image_data(image_record.image_data)
            result["image"] = "complete"
        except Exception as exc:
            logger.exception("Image embedding failed for report %s", report.id)
            result["image"] = "failed"
            result["errors"].append(f"image: {exc}")
    else:
        result["image"] = "missing"

    try:
        report.text_embedding = embed_report_text(report)
        result["text"] = "complete"
    except Exception as exc:
        logger.exception("Text embedding failed for report %s", report.id)
        result["text"] = "failed"
        result["errors"].append(f"text: {exc}")

    return result


def public_embedding_status(result: dict) -> dict:
    return {"image": result.get("image"), "text": result.get("text")}


# --- FastAPI App ---

app = FastAPI(
    title="fAInd It API",
    version="1.0.0",
    description="AI-powered lost-and-found object matching platform",
)

# CORS - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "BACKEND_CORS_ORIGINS", "http://localhost:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health Check ---

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}


# --- Authentication Routes ---

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(
    email: str = Form(...),
    password: str = Form(...),
    mobile_number: str = Form(...),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    mobile = mobile_number.strip()
    digits = "".join(character for character in mobile if character.isdigit())
    if not 7 <= len(digits) <= 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid mobile number with 7 to 15 digits",
        )

    hashed_password = get_password_hash(password)
    user = User(email=email, mobile_number=mobile, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "mobile_number": user.mobile_number,
    }


@app.post("/auth/token", status_code=status.HTTP_200_OK)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=str(user.id))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": str(user.id),
        "email": user.email,
        "mobile_number": user.mobile_number,
        "is_superuser": user.is_superuser,
    }


@app.get("/auth/me", status_code=status.HTTP_200_OK)
def current_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "mobile_number": current_user.mobile_number,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "created_at": current_user.created_at.isoformat()
        if current_user.created_at
        else None,
    }


# --- Report Routes ---

@app.post("/reports/", status_code=status.HTTP_201_CREATED)
async def create_report(
    report_type: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    color: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    event_date: Optional[datetime] = Form(None),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if report_type not in ("LOST", "FOUND"):
        raise HTTPException(status_code=400, detail="Report type must be LOST or FOUND")

    image_data = await image.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(image_data) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"Image is too large. Maximum size is {MAX_UPLOAD_SIZE_MB} MB.",
        )

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, detail="Invalid image type. Use JPEG, PNG, or WebP."
        )

    report = Report(
        type=report_type,
        title=title,
        description=description,
        category=category,
        color=color,
        location=location,
        event_date=event_date,
        owner_id=current_user.id,
    )

    db.add(report)
    db.flush()

    save_report_image(db, report, image, image_data)
    db.flush()
    embedding_result = generate_embeddings_for_report(report)

    db.commit()
    db.refresh(report)

    response = report.to_dict()
    response["embedding_status"] = public_embedding_status(embedding_result)
    return response


@app.get("/reports/")
def list_reports(
    report_type: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Report).filter(Report.is_active == True)

    if report_type:
        query = query.filter(Report.type == report_type)

    if category:
        query = query.filter(Report.category == category)

    if not current_user.is_superuser:
        query = query.filter(Report.owner_id == current_user.id)

    reports = query.offset(skip).limit(limit).all()
    return [report.to_dict() for report in reports]


@app.get("/reports/{report_id}")
def get_report(
    report_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id, Report.is_active == True).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to view this report")

    return report.to_dict()


@app.put("/reports/{report_id}")
async def update_report(
    report_id: PyUUID,
    report_type: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    color: Optional[str] = None,
    location: Optional[str] = None,
    event_date: Optional[datetime] = None,
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to update this report")

    if report_type:
        if report_type not in ("LOST", "FOUND"):
            raise HTTPException(status_code=400, detail="Report type must be LOST or FOUND")
        report.type = report_type
    if title is not None:
        report.title = title
    if description is not None:
        report.description = description
    if category is not None:
        report.category = category
    if color is not None:
        report.color = color
    if location is not None:
        report.location = location
    if event_date is not None:
        report.event_date = event_date

    if image:
        image_data = await image.read()
        if not image_data:
            raise HTTPException(status_code=400, detail="Image file is empty")
        if len(image_data) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"Image is too large. Maximum size is {MAX_UPLOAD_SIZE_MB} MB.",
            )
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid image type.")
        save_report_image(db, report, image, image_data)
        db.flush()

    embedding_result = generate_embeddings_for_report(report)

    db.commit()
    db.refresh(report)
    response = report.to_dict()
    response["embedding_status"] = public_embedding_status(embedding_result)
    return response


@app.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this report")

    report.is_active = False
    db.commit()
    return None


# --- Matching / Ranking Routes ---

@app.post("/matches/", status_code=status.HTTP_200_OK)
def find_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_reports = db.query(Report).filter(
        Report.owner_id == current_user.id, Report.is_active == True
    ).all()

    if not user_reports:
        return {"matches": [], "message": "No reports found for this user."}

    results = []
    for source_report in user_reports:
        candidates = (
            db.query(Report)
            .filter(
                Report.type != source_report.type,
                Report.is_active == True,
                Report.status == "OPEN",
                Report.moderation_status == "ACTIVE",
            )
            .all()
        )
        ranked = rank_candidates(source_report, candidates, top_k=5, viewer_id=current_user.id)
        results.append(
            {
                "source_report_id": str(source_report.id),
                "source_report": source_report.to_dict(),
                "matches": ranked,
            }
        )

    return {"matches": results, "scoring_version": SCORING_VERSION}


@app.get("/reports/{report_id}/matches", status_code=status.HTTP_200_OK)
def get_report_matches(
    report_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source_report = db.query(Report).filter(Report.id == report_id).first()
    if not source_report:
        raise HTTPException(status_code=404, detail="Report not found")
    if source_report.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to view matches")

    candidates = (
        db.query(Report)
        .filter(
            Report.type != source_report.type,
            Report.is_active == True,
            Report.status == "OPEN",
            Report.moderation_status == "ACTIVE",
        )
        .all()
    )
    ranked = rank_candidates(source_report, candidates, top_k=5, viewer_id=current_user.id)
    return {
        "source_report_id": str(source_report.id),
        "source_report": source_report.to_dict(),
        "matches": ranked,
        "scoring_version": SCORING_VERSION,
    }


@app.post("/reports/{report_id}/matches/refresh", status_code=status.HTTP_200_OK)
def refresh_report_matches(
    report_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_report_matches(report_id=report_id, current_user=current_user, db=db)


@app.post("/reports/{report_id}/retry-embeddings", status_code=status.HTTP_200_OK)
def retry_report_embeddings(
    report_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to retry embeddings")

    result = generate_embeddings_for_report(report)
    db.commit()
    db.refresh(report)
    return {"report_id": str(report.id), "embedding_status": public_embedding_status(result)}


@app.get("/uploads/{report_id}")
def serve_report_image(
    report_id: PyUUID,
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    image = db.query(ReportImage).filter(ReportImage.report_id == report_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    return Response(
        content=image.image_data,
        media_type=image.content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


def calculate_metadata_similarity(report1: Report, report2: Report) -> float:
    """Backward-compatible wrapper around the metadata service."""
    return metadata_similarity(report1, report2)


# --- Claim Routes ---


class ClaimCreateRequest(BaseModel):
    found_report_id: PyUUID
    message: str = Field(min_length=1, max_length=2000)


def claim_to_dict(claim: Claim, viewer: Optional[User] = None) -> dict:
    status = (claim.status or "PENDING").upper()
    contact = None
    if status == "ACCEPTED" and viewer is not None:
        is_participant = viewer.id in {claim.claimant_id, claim.reported_owner_id}
        if is_participant:
            contact = {
                "claimant_mobile": (
                    claim.claimant.mobile_number if claim.claimant else None
                ),
                "owner_mobile": (
                    claim.reported_owner.mobile_number
                    if claim.reported_owner
                    else None
                ),
            }

    return {
        "id": str(claim.id),
        "status": status,
        "message": claim.message or "",
        "report_id": str(claim.report_id),
        "claimant_id": str(claim.claimant_id),
        "reported_owner_id": str(claim.reported_owner_id),
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
        "reviewed_at": claim.reviewed_at.isoformat() if claim.reviewed_at else None,
        "report": claim.report.to_dict() if claim.report else None,
        "contact": contact,
    }


def _pending_claim_query(db: Session, report_id, claimant_id):
    return (
        db.query(Claim)
        .filter(
            Claim.report_id == report_id,
            Claim.claimant_id == claimant_id,
            func.upper(Claim.status) == "PENDING",
        )
        .first()
    )


@app.post("/claims", status_code=status.HTTP_201_CREATED)
def create_claim(
    payload: ClaimCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == payload.found_report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Found report not found")
    if report.type != "FOUND":
        raise HTTPException(status_code=400, detail="Claims can only target FOUND reports")
    if report.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot claim your own found report")
    if (
        not report.is_active
        or report.status != "OPEN"
        or report.moderation_status != "ACTIVE"
    ):
        raise HTTPException(status_code=400, detail="This report is not open for claims")

    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="A verification message is required")

    if _pending_claim_query(db, report.id, current_user.id):
        raise HTTPException(
            status_code=409, detail="You already have a pending claim for this report"
        )

    claim = Claim(
        report_id=report.id,
        claimant_id=current_user.id,
        reported_owner_id=report.owner_id,
        message=message,
        status="PENDING",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim_to_dict(claim, current_user)


@app.get("/claims/mine", status_code=status.HTTP_200_OK)
def list_my_claims(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Claim).filter(Claim.claimant_id == current_user.id)
    if status:
        query = query.filter(func.upper(Claim.status) == status.upper())
    claims = query.order_by(Claim.created_at.desc()).all()
    return [claim_to_dict(claim, current_user) for claim in claims]


@app.get("/claims/received", status_code=status.HTTP_200_OK)
def list_received_claims(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Claim).filter(Claim.reported_owner_id == current_user.id)
    if status:
        query = query.filter(func.upper(Claim.status) == status.upper())
    claims = query.order_by(Claim.created_at.desc()).all()
    return [claim_to_dict(claim, current_user) for claim in claims]


@app.get("/claims/{claim_id}", status_code=status.HTTP_200_OK)
def get_claim(
    claim_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if (
        claim.claimant_id != current_user.id
        and claim.reported_owner_id != current_user.id
        and not current_user.is_superuser
    ):
        raise HTTPException(status_code=403, detail="Not authorized to view this claim")

    return claim_to_dict(claim, current_user)


@app.post("/claims/{claim_id}/accept", status_code=status.HTTP_200_OK)
def accept_claim(
    claim_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Found-report owner/admin accepts a claim."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.reported_owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only the found-report owner can accept")

    if (claim.status or "").upper() != "PENDING":
        raise HTTPException(status_code=409, detail="Claim is not pending")

    existing_accepted = (
        db.query(Claim)
        .filter(
            Claim.report_id == claim.report_id,
            Claim.id != claim.id,
            func.upper(Claim.status) == "ACCEPTED",
        )
        .first()
    )
    if existing_accepted:
        raise HTTPException(
            status_code=409, detail="Another claim for this report is already accepted"
        )

    try:
        claim.status = "ACCEPTED"
        claim.reviewed_at = func.now()

        if claim.report:
            claim.report.status = "MATCHED"

        other_pending = (
            db.query(Claim)
            .filter(
                Claim.report_id == claim.report_id,
                Claim.id != claim.id,
                func.upper(Claim.status) == "PENDING",
            )
            .all()
        )
        for other in other_pending:
            other.status = "REJECTED"
            other.reviewed_at = func.now()

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(claim)
    return claim_to_dict(claim, current_user)


@app.post("/claims/{claim_id}/reject", status_code=status.HTTP_200_OK)
def reject_claim(
    claim_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Found-report owner/admin rejects a claim."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.reported_owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only the found-report owner can reject")

    if (claim.status or "").upper() != "PENDING":
        raise HTTPException(status_code=409, detail="Claim is not pending")

    claim.status = "REJECTED"
    claim.reviewed_at = func.now()
    db.commit()
    db.refresh(claim)
    return claim_to_dict(claim, current_user)


@app.get("/claims/", status_code=status.HTTP_200_OK)
def list_claims(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Backward-compatible combined list of submitted and received claims."""
    query = db.query(Claim)
    if not current_user.is_superuser:
        query = query.filter(
            (Claim.claimant_id == current_user.id)
            | (Claim.reported_owner_id == current_user.id)
        )
    if status:
        query = query.filter(func.upper(Claim.status) == status.upper())
    claims = query.order_by(Claim.created_at.desc()).all()
    return [claim_to_dict(claim, current_user) for claim in claims]


# --- Admin Routes ---

@app.get("/admin/reports", status_code=status.HTTP_200_OK)
def admin_list_reports(
    report_type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    moderation_status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin list and filter reports."""
    query = db.query(Report)
    if report_type:
        query = query.filter(Report.type == report_type)
    if category:
        query = query.filter(Report.category == category)
    if status:
        query = query.filter(Report.status == status.upper())
    if moderation_status:
        query = query.filter(Report.moderation_status == moderation_status.upper())
    if search:
        query = query.filter(Report.title.ilike(f"%{search}%"))
    reports = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    return [report.to_dict() for report in reports]


@app.post("/admin/reports/{report_id}/flag", status_code=status.HTTP_200_OK)
def admin_flag_report(
    report_id: PyUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin flags a report for review."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.moderation_status = "FLAGGED"
    db.commit()
    return {"message": "Report flagged successfully", "report": report.to_dict()}


@app.post("/admin/reports/{report_id}/remove", status_code=status.HTTP_200_OK)
def admin_remove_report(
    report_id: PyUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin soft-removes a report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.moderation_status = "REMOVED"
    report.is_active = False
    db.commit()
    return {"message": "Report removed successfully", "report": report.to_dict()}


@app.get("/admin/claims", status_code=status.HTTP_200_OK)
def admin_list_claims(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin list claims."""
    query = db.query(Claim)
    if status:
        query = query.filter(func.upper(Claim.status) == status.upper())
    claims = query.order_by(Claim.created_at.desc()).all()
    return [claim_to_dict(claim, current_user) for claim in claims]


def _evaluation_run_enabled() -> bool:
    return os.getenv("EVALUATION_RUN_ENABLED", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _evaluation_run_record(results: dict) -> EvaluationRun:
    run = results.get("run") or {}
    dataset = results.get("dataset") or {}
    run_at = None
    if run.get("run_at"):
        try:
            run_at = datetime.fromisoformat(run["run_at"])
        except ValueError:
            run_at = None

    return EvaluationRun(
        run_at=run_at,
        scoring_version=run.get("scoring_version"),
        top_k=run.get("top_k"),
        dataset_name=dataset.get("name"),
        dataset_version=dataset.get("version"),
        query_count=dataset.get("query_count"),
        candidate_count=dataset.get("candidate_count"),
        results=results,
    )


@app.get("/evaluation/summary", status_code=status.HTTP_200_OK)
def evaluation_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest saved evaluation run from PostgreSQL."""
    config = evaluation_config()
    can_run = bool(current_user.is_superuser and _evaluation_run_enabled())
    latest = (
        db.query(EvaluationRun)
        .order_by(EvaluationRun.created_at.desc())
        .first()
    )

    if latest is None:
        return {
            "available": False,
            "can_run": can_run,
            "message": "No evaluation has been run yet.",
            "config": config,
        }

    return {
        "available": True,
        "can_run": can_run,
        "config": config,
        **(latest.results or {}),
    }


@app.get("/evaluation/runs", status_code=status.HTTP_200_OK)
def evaluation_runs(
    current_user: User = Depends(get_current_active_superuser),
    db: Session = Depends(get_db),
):
    """Return evaluation run history without the full per-query payload."""
    runs = (
        db.query(EvaluationRun)
        .order_by(EvaluationRun.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": str(run.id),
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "run_at": run.run_at.isoformat() if run.run_at else None,
            "scoring_version": run.scoring_version,
            "top_k": run.top_k,
            "dataset_name": run.dataset_name,
            "dataset_version": run.dataset_version,
            "query_count": run.query_count,
            "candidate_count": run.candidate_count,
        }
        for run in runs
    ]


@app.post("/evaluation/run", status_code=status.HTTP_200_OK)
def evaluation_run(
    current_user: User = Depends(get_current_active_superuser),
    db: Session = Depends(get_db),
):
    """Run the controlled, offline evaluation and save its results to PostgreSQL."""
    if not _evaluation_run_enabled():
        raise HTTPException(
            status_code=403,
            detail="Evaluation execution is disabled on this server",
        )

    try:
        results = run_evaluation()
    except EvaluationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Evaluation run failed")
        raise HTTPException(
            status_code=500,
            detail="Evaluation failed. Check the backend logs for details.",
        ) from exc

    record = _evaluation_run_record(results)
    db.add(record)
    db.commit()

    return {
        "available": True,
        "can_run": True,
        "config": evaluation_config(),
        **results,
    }


# --- Startup ---

@app.on_event("startup")
def startup():
    """Create database tables on startup."""
    try:
        Base.metadata.create_all(bind=engine)
        ensure_schema()
    except Exception as e:
        print(f"Warning: Could not create tables on startup: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

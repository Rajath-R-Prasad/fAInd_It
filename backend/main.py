"""fAInd It - Backend API Application"""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from functools import reduce

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    UUID,
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
from jose import JWTError, jwt
from uuid import UUID as PyUUID, uuid4


# --- Database Configuration ---
DATABASE_URL = os.getenv(
    "POSTGRES_DSN",
    "postgresql://fainit_user:your_secure_password@localhost:5432/fainit"
)

database_url = make_url(DATABASE_URL)
if database_url.drivername in {"postgres", "postgresql", "postgresql+psycopg"}:
    database_url = database_url.set(drivername="postgresql+psycopg2")

engine = create_engine(
    database_url,
    pool_size=5,
    max_overflow=10,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# --- SQLAlchemy Models ---

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    reports = relationship("Report", back_populates="owner")
    claims = relationship("Claim", back_populates="claimant")


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

    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="reports")

    image_embedding = Column("image_embedding", ARRAY(Float), nullable=True)
    text_embedding = Column("text_embedding", ARRAY(Float), nullable=True)

    category_similarity = Column(Float, nullable=True)
    color_similarity = Column(Float, nullable=True)
    location_similarity = Column(Float, nullable=True)
    date_similarity = Column(Float, nullable=True)

    final_score = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True)

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
            "image_url": f"/api/v1/uploads/{self.id}.jpg" if self.id else None,
        }


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False)
    claimant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reported_owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    report = relationship("Report", foreign_keys=[report_id])
    claimant = relationship("User", foreign_keys=[claimant_id])
    reported_owner = relationship("User", foreign_keys=[reported_owner_id])


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
        expire = datetime.utcnow() + timedelta(minutes=15)
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


# --- FastAPI App ---

app = FastAPI(
    title="fAInd It API",
    version="1.0.0",
    description="AI-powered lost-and-found object matching platform",
)

# CORS - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("VITE_API_BASE_URL", "http://localhost:5173")],
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
    email: str,
    password: str,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_password = get_password_hash(password)
    user = User(email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "email": user.email}


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
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


# --- Report Routes ---

@app.post("/reports/", status_code=status.HTTP_201_CREATED)
async def create_report(
    report_type: str,
    title: str,
    description: Optional[str],
    category: Optional[str],
    color: Optional[str],
    location: Optional[str],
    event_date: Optional[datetime],
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if report_type not in ("LOST", "FOUND"):
        raise HTTPException(status_code=400, detail="Report type must be LOST or FOUND")

    image_data = await image.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="Image file is empty")

    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, detail="Invalid image type. Use JPEG, PNG, or WebP."
        )

    upload_dir = "/app/backend/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    image_path = f"{upload_dir}/{current_user.id}_{image.filename}"
    with open(image_path, "wb") as f:
        f.write(image_data)

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
    db.commit()
    db.refresh(report)

    return {
        "id": str(report.id),
        "type": report.type,
        "title": report.title,
        "description": report.description,
        "category": report.category,
        "color": report.color,
        "location": report.location,
        "event_date": report.event_date.isoformat() if report.event_date else None,
        "image_url": f"/api/v1/uploads/{report.id}.jpg",
    }


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
        allowed_types = ["image/jpeg", "image/png", "image/webp"]
        if image.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid image type.")
        upload_dir = "/app/backend/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        image_path = f"{upload_dir}/{current_user.id}_{image.filename}"
        with open(image_path, "wb") as f:
            f.write(image_data)

    db.commit()
    db.refresh(report)
    return report.to_dict()


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
    import numpy as np

    user_reports = db.query(Report).filter(
        Report.owner_id == current_user.id, Report.is_active == True
    ).all()

    if not user_reports:
        return {"matches": [], "message": "No reports found for this user."}

    matches = []

    for user_report in user_reports:
        opposite_reports = (
            db.query(Report)
            .filter(
                Report.type != user_report.type,
                Report.owner_id != current_user.id,
                Report.is_active == True,
            )
            .all()
        )

        report_matches = []
        for opp_report in opposite_reports:
            # Image similarity (CLIP cosine similarity)
            image_sim = 0.0
            if user_report.image_embedding and opp_report.image_embedding:
                u_emb = np.array(user_report.image_embedding, dtype=float)
                o_emb = np.array(opp_report.image_embedding, dtype=float)
                if np.linalg.norm(u_emb) > 0 and np.linalg.norm(o_emb) > 0:
                    image_sim = float(
                        np.dot(u_emb / np.linalg.norm(u_emb), o_emb / np.linalg.norm(o_emb))
                    )

            # Text similarity (Sentence-Transformer cosine similarity)
            text_sim = 0.0
            if user_report.text_embedding and opp_report.text_embedding:
                u_emb = np.array(user_report.text_embedding, dtype=float)
                o_emb = np.array(opp_report.text_embedding, dtype=float)
                if np.linalg.norm(u_emb) > 0 and np.linalg.norm(o_emb) > 0:
                    text_sim = float(
                        np.dot(u_emb / np.linalg.norm(u_emb), o_emb / np.linalg.norm(o_emb))
                    )

            # Metadata similarity
            metadata_sim = calculate_metadata_similarity(user_report, opp_report)

            # Final fused score (weighted average)
            final_score = round(
                0.4 * image_sim + 0.3 * text_sim + 0.3 * metadata_sim, 4
            )

            report_matches.append(
                {
                    "report_id": str(opp_report.id),
                    "report": {
                        "id": str(opp_report.id),
                        "type": opp_report.type,
                        "title": opp_report.title,
                        "description": opp_report.description,
                        "category": opp_report.category,
                        "color": opp_report.color,
                        "location": opp_report.location,
                        "event_date": opp_report.event_date.isoformat() if opp_report.event_date else None,
                        "image_url": f"/api/v1/uploads/{opp_report.id}.jpg" if opp_report.id else None,
                    },
                    "scores": {
                        "image_similarity": round(image_sim, 4),
                        "text_similarity": round(text_sim, 4),
                        "metadata_similarity": round(metadata_sim, 4),
                        "final_score": final_score,
                    },
                }
            )

        # Sort by final_score descending and take top 5
        report_matches.sort(key=lambda x: x["scores"]["final_score"], reverse=True)
        matches.append(
            {
                "source_report_id": str(user_report.id),
                "source_report": {
                    "id": str(user_report.id),
                    "type": user_report.type,
                    "title": user_report.title,
                },
                "matches": report_matches[:5],
            }
        )

    return {"matches": matches}


def calculate_metadata_similarity(report1: Report, report2: Report) -> float:
    """Calculate metadata similarity between two reports based on category, colour, location, and date."""
    scores = []

    # Category similarity
    if report1.category and report2.category:
        if report1.category.lower() == report2.category.lower():
            scores.append(1.0)
        else:
            scores.append(0.0)
    else:
        scores.append(0.0)

    # Colour similarity
    if report1.color and report2.color:
        if report1.color.lower() == report2.color.lower():
            scores.append(1.0)
        else:
            scores.append(0.0)
    else:
        scores.append(0.0)

    # Location similarity (simple string match; could be enhanced with geocoding)
    if report1.location and report2.location:
        if report1.location.lower() in report2.location.lower() or report2.location.lower() in report1.location.lower():
            scores.append(1.0)
        else:
            scores.append(0.0)
    else:
        scores.append(0.0)

    # Date similarity (within 7 days = high similarity, within 30 days = medium, else low)
    if report1.event_date and report2.event_date:
        delta = abs((report1.event_date - report2.event_date).days)
        if delta <= 1:
            scores.append(1.0)
        elif delta <= 7:
            scores.append(0.7)
        elif delta <= 30:
            scores.append(0.4)
        else:
            scores.append(0.1)
    else:
        scores.append(0.0)

    # Average of all metadata similarity components
    if scores:
        return sum(scores) / len(scores)
    return 0.0


# --- Claim Routes ---

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

    # Check authorization: claimant or reported owner or admin
    if claim.claimant_id != current_user.id and claim.reported_owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to accept this claim")

    if claim.status != "pending":
        return {"message": "Claim is not in pending status"}

    claim.status = "accepted"

    db.commit()
    db.refresh(claim)
    return {"id": str(claim.id), "status": claim.status, "message": "Claim accepted"}


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

    # Check authorization
    if claim.claimant_id != current_user.id and claim.reported_owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to reject this claim")

    claim.status = "rejected"

    db.commit()
    db.refresh(claim)
    return {"id": str(claim.id), "status": claim.status, "message": "Claim rejected"}


@app.get("/claims/", status_code=status.HTTP_200_OK)
def list_claims(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List claims. Admin sees all; users see their own claims (as claimant or reported owner)."""
    query = db.query(Claim)
    if not current_user.is_superuser:
        claims = [
            c
            for c in query.all()
            if c.claimant_id == current_user.id or c.reported_owner_id == current_user.id
        ]
    else:
        claims = query.all()
    if status:
        claims = [c for c in claims if c.status == status]

    return [{"id": str(c.id), "status": c.status, "report_id": str(c.report_id)} for c in claims]


# --- Admin Routes ---

@app.get("/admin/reports", status_code=status.HTTP_200_OK)
def admin_list_reports(
    report_type: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin list and filter reports."""
    query = db.query(Report).filter(Report.is_active == True)
    if report_type:
        query = query.filter(Report.type == report_type)
    if category:
        query = query.filter(Report.category == category)
    reports = query.offset(skip).limit(limit).all()
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
    report.is_active = False  # Soft-remove / flag
    db.commit()
    return {"message": "Report flagged successfully"}


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
    report.is_active = False
    db.commit()
    return {"message": "Report removed successfully"}


@app.get("/admin/claims", status_code=status.HTTP_200_OK)
def admin_list_claims(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Admin list claims."""
    query = db.query(Claim)
    if status:
        query = query.filter(Claim.status == status)
    claims = query.all()
    return [
        {
            "id": str(c.id),
            "status": c.status,
            "report_id": str(c.report_id),
            "claimant_id": str(c.claimant_id),
            "reported_owner_id": str(c.reported_owner_id),
        }
        for c in claims
    ]


@app.get("/evaluation/summary", status_code=status.HTTP_200_OK)
def evaluation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Return saved evaluation results."""
    # Placeholder - would return stored evaluation results
    return {"message": "Evaluation summary not yet available", "experiments_run": 0}


@app.post("/evaluation/run", status_code=status.HTTP_200_OK)
def evaluation_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Run evaluation script or trigger controlled evaluation."""
    # Placeholder - evaluation execution
    return {"message": "Evaluation triggered", "experiment_count": 0}


# --- Startup ---

@app.on_event("startup")
def startup():
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

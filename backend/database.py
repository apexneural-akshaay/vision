"""
Vision AI Platform – SQLAlchemy database layer
vision.db is auto-created in the same directory as this file.
"""

import os
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.pool import NullPool

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DB_PATH      = os.path.join(BASE_DIR, "vision.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# NullPool: every request gets its own connection, closed immediately on release.
# This prevents connection exhaustion when MJPEG streams hold connections open.
engine       = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


# ── ORM models ────────────────────────────────────────────────────────────────

class Device(Base):
    __tablename__ = "devices"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String, unique=True, index=True)   # 8-char hex UUID
    name        = Column(String, nullable=False)
    device_type = Column(String, default="DVR")
    ip          = Column(String, nullable=False)
    username    = Column(String, nullable=False)
    password    = Column(String, nullable=False)
    rtsp_port   = Column(Integer, default=554)

    cameras = relationship(
        "Camera",
        back_populates="device",
        cascade="all, delete-orphan",
    )


class Camera(Base):
    __tablename__ = "cameras"

    id         = Column(Integer, primary_key=True, index=True)
    device_id  = Column(Integer, ForeignKey("devices.id"), nullable=False)
    name       = Column(String, nullable=False)
    channel    = Column(Integer, nullable=False)
    rtsp_url   = Column(String, nullable=False)
    status     = Column(String, default="unknown")
    resolution = Column(String, default="")

    device      = relationship("Device", back_populates="cameras")
    deployments = relationship(
        "Deployment",
        back_populates="camera",
        cascade="all, delete-orphan",
    )


class MLModel(Base):
    __tablename__ = "models"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, nullable=False)
    version        = Column(String, default="v1.0")
    framework      = Column(String, default="YOLOv8")
    size           = Column(String, default="")
    accuracy       = Column(Integer, default=0)
    file_path      = Column(String, nullable=False)
    inference_path = Column(String, nullable=False)

    deployments = relationship("Deployment", back_populates="model")


class Deployment(Base):
    __tablename__ = "deployments"

    id        = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    model_id  = Column(Integer, ForeignKey("models.id"), nullable=False)
    status    = Column(String, default="active")

    camera = relationship("Camera", back_populates="deployments")
    model  = relationship("MLModel", back_populates="deployments")


# ── Helpers ───────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency – yields a DB session and closes it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

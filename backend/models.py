from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True)
    instructor_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    room_code = Column(String, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String)
    room_code = Column(String, index=True)
    code = Column(String)
    output = Column(String)
    status = Column(String, default="ok")
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    
class TeacherEdit(Base):
    __tablename__ = "teacher_edits"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String)
    room_code = Column(String, index=True)
    original_code = Column(String)
    edited_code = Column(String)
    edited_at = Column(DateTime(timezone=True), server_default=func.now())
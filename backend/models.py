from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True)
    instructor_name = Column(String)
    mode = Column(String, default="teaching")
    ended = Column(Boolean, default=False)
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
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    is_correct = Column(Boolean, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    
class TeacherEdit(Base):
    __tablename__ = "teacher_edits"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String)
    room_code = Column(String, index=True)
    original_code = Column(String)
    edited_code = Column(String)
    edited_at = Column(DateTime(timezone=True), server_default=func.now())


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    question_text = Column(String, nullable=False)
    expected_output = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())    
import { useState, useEffect } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'

function App() {
  const [message, setMessage] = useState('Loading...')
  const [backendOk, setBackendOk] = useState(true)
  const [liveText, setLiveText] = useState('')
  const [received, setReceived] = useState('')
  const [ws, setWs] = useState(null)
  const [code, setCode] = useState('print("Hello, Dev-Arena!")')
  const [language, setLanguage] = useState('python')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [role, setRole] = useState(null) 
  const [createdRoomCode, setCreatedRoomCode] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [roomMode, setRoomMode] = useState('teaching')
  const [questions, setQuestions] = useState([{ question_text: '', expected_output: '' }])
  const [submissions, setSubmissions] = useState({})
  const [editingStudent, setEditingStudent] = useState(null)
  const [editedCode, setEditedCode] = useState('') 
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [pendingTeacherEdit, setPendingTeacherEdit] = useState(null)
  const [raisedHands, setRaisedHands] = useState({})
  const [studentRoomMode, setStudentRoomMode] = useState('teaching')
  const [studentQuestions, setStudentQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [questionCode, setQuestionCode] = useState({})
  const [questionResults, setQuestionResults] = useState({})
  const [helpRequested, setHelpRequested] = useState(false)

  const currentQuestion = studentQuestions[currentQuestionIndex] || null
  const activeCode = (studentRoomMode === 'assessment' && currentQuestion)
    ? (questionCode[currentQuestion.id] ?? '')
    : code

    useEffect(() => {
    fetch('http://127.0.0.1:8000/')
      .then(res => res.json())
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
  }, [])

      useEffect(() => {
        const savedRole = sessionStorage.getItem('devarena_role')
        const savedRoom = sessionStorage.getItem('devarena_room')

    if (savedRole === 'instructor' && savedRoom) {
      setRole('instructor')
      setCreatedRoomCode(savedRoom)
      setJoined(true)

      fetch(`http://127.0.0.1:8000/room-status/${savedRoom}`)
        .then(res => res.json())
        .then(data => setSubmissions(data))
        .catch(() => console.error('Could not restore room status'))

      fetch(`http://127.0.0.1:8000/room-mode/${savedRoom}`)
        .then(res => res.json())
        .then(data => setRoomMode(data.mode || 'teaching'))
        .catch(() => console.error('Could not restore room mode'))
    }
  }, [])

    useEffect(() => {
    if (!joined) return

    const activeRoomCode = role === 'student' ? roomCode : createdRoomCode
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/${activeRoomCode}`)

    socket.onopen = () => {
      if (role === 'student') {
        socket.send(JSON.stringify({
          type: 'join',
          student_name: studentName
        }))
      }
    }

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)

          if (parsed.type === 'submission') {
          setSubmissions(prev => ({
            ...prev,
            [parsed.student_name]: { code: parsed.code, output: parsed.output, status: parsed.status, is_correct: parsed.is_correct }
          }))
        }

          else if (parsed.type === 'join') {
          setSubmissions(prev => {
            if (prev[parsed.student_name]) return prev
            return {
              ...prev,
              [parsed.student_name]: { code: '', output: '', status: 'none' }
            }
          })
        }

        else if (parsed.type === 'leave') {
          setSubmissions(prev => {
            const updated = { ...prev }
            delete updated[parsed.student_name]
            return updated
          })
        }

        else if (parsed.type === 'teacher_edit') {
          if (role === 'student' && parsed.student_name === studentName) {
            setPendingTeacherEdit(parsed.edited_code)
          }
        }

        else if (parsed.type === 'raise_hand') {
          setRaisedHands(prev => ({
            ...prev,
            [parsed.student_name]: true
          }))
        }

        else if (parsed.type === 'hand_cleared') {
          if (role === 'student' && parsed.student_name === studentName) {
            setHelpRequested(false)
          }
        }
        
        else if (parsed.type === 'live_code') {
          setSubmissions(prev => ({
            ...prev,
            [parsed.student_name]: {
              ...(prev[parsed.student_name] || {}),
              code: parsed.code,
              output: (prev[parsed.student_name] || {}).output || '',
              status: (prev[parsed.student_name] || {}).status || 'none'
            }
          }))
        }

        else {
          setReceived(event.data)
        }

      } catch (e) {
        setReceived(event.data)
      }
    }
    setWs(socket)

    return () => socket.close()
  }, [joined])

  const sendMessage = () => {
    if (ws) ws.send(liveText)
  }

  const joinRoom = async () => {
    setJoinError('')
    try {
      const res = await fetch(`http://127.0.0.1:8000/join-room/${roomCode}?student_name=${studentName}`)
      const data = await res.json()
      if (data.error) {
        setJoinError(data.error)
      } else {
        setStudentRoomMode(data.mode || 'teaching')
        if (data.questions && data.questions.length > 0) {
          setStudentQuestions(data.questions)
          const initialCode = {}
          data.questions.forEach(q => {
            initialCode[q.id] = 'print("Hello, Dev-Arena!")'
          })
          setQuestionCode(initialCode)
        }
        setJoined(true)
      }
    } catch (err) {
      setJoinError('Could not reach backend')
    }
}

const createRoom = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_name: instructorName,
          mode: roomMode,
          questions: roomMode === 'assessment' ? questions : []
        })
      })
      const data = await res.json()
      setCreatedRoomCode(data.room_code)
      setJoined(true)
      sessionStorage.setItem('devarena_role', 'instructor')
      sessionStorage.setItem('devarena_room', data.room_code)
    } catch (err) {
      console.error('Could not create room')
    }
}

const saveTeacherEdit = async (studentName) => {
    try {
      await fetch('http://127.0.0.1:8000/teacher-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName,
          room_code: createdRoomCode,
          original_code: submissions[studentName].code,
          edited_code: editedCode
        })
      })

      if (ws) {
        ws.send(JSON.stringify({
          type: 'teacher_edit',
          student_name: studentName,
          edited_code: editedCode
        }))
      }

      setEditingStudent(null)
    } catch (err) {
      console.error('Could not save edit')
    }
}

  const runCode = async () => {
    setRunning(true)
    setOutput('Running...')
    const codeToRun = (studentRoomMode === 'assessment' && currentQuestion) ? activeCode : code
    try {
            const res = await fetch('http://127.0.0.1:8000/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            code: codeToRun,
            language,
            student_name: role === 'student' ? studentName : instructorName,
            room_code: role === 'student' ? roomCode : createdRoomCode,
            question_id: (studentRoomMode === 'assessment' && currentQuestion) ? currentQuestion.id : null
        })
      })

      const data = await res.json()
      setOutput(data.output || data.stderr || 'No output')

      if (studentRoomMode === 'assessment' && currentQuestion) {
        setQuestionResults(prev => ({ ...prev, [currentQuestion.id]: data.is_correct }))
      }

        if (ws && role === 'student') {
        ws.send(JSON.stringify({
          type: 'submission',
          student_name: studentName,
          code: codeToRun,
          output: data.output || data.stderr || 'No output',
          status: data.stderr ? 'error' : 'ok',
          is_correct: data.is_correct
        }))
      }

    } catch (err) {
      setOutput('Error: could not reach backend')
    }
    setRunning(false)
  }

    return (
    <div className="app-shell">
      <h1 className="app-title">Dev-Arena</h1>
      <p className="app-tagline">
        {backendOk ? 'Teach live. Assess instantly.' : '⚠️ Backend not reachable'}
      </p>

      {joined && role === 'instructor' && (
        <div className="dashboard-shell">
          <p className="dashboard-room-code">
            Room Code: <strong>{createdRoomCode}</strong>
          </p>

          <div className="dashboard-card">

            {!selectedStudent ? (
              <>
               <div className="status-legend">
                  <span><span className="status-dot" style={{ background: 'var(--accent-green)' }}></span>{Object.values(submissions).filter(s => s.status !== 'error' && s.status !== 'none').length} Success</span>
                  <span><span className="status-dot" style={{ background: 'var(--accent-red)' }}></span>{Object.values(submissions).filter(s => s.status === 'error').length} Error</span>
                  <span><span className="status-dot" style={{ background: 'var(--accent-gray)' }}></span>{Object.values(submissions).filter(s => s.status === 'none').length} Not run yet</span>
                </div>

                <p className="connected-count">
                  {Object.keys(submissions).length} student{Object.keys(submissions).length !== 1 ? 's' : ''} connected
                </p>

                {Object.keys(submissions).length === 0 ? (
                  <p className="empty-state">No submissions yet.</p>
                ) : (
                  Object.entries(submissions).map(([name, sub]) => (
                    <div
                      key={name}
                      className="student-row"
                      onClick={() => {
                        setSelectedStudent(name)
                        if (raisedHands[name] && ws) {
                          ws.send(JSON.stringify({
                            type: 'hand_cleared',
                            student_name: name
                          }))
                        }
                        setRaisedHands(prev => {
                          const updated = { ...prev }
                          delete updated[name]
                          return updated
                        })
                      }}
                    >
                      <div className="student-row-left">
                          <span
                          className="student-row-dot"
                          style={{ background: sub.status === 'error' ? 'var(--accent-red)' : sub.status === 'none' ? 'var(--accent-gray)' : 'var(--accent-green)' }}
                        ></span>
                        <span className="student-name">{name}</span>
                        {roomMode === 'assessment' && sub.is_correct === true && (
                          <span className="correctness-badge correct">Correct</span>
                        )}
                        {roomMode === 'assessment' && sub.is_correct === false && (
                          <span className="correctness-badge incorrect">Incorrect</span>
                        )}
                        {raisedHands[name] && <span>🖐️</span>}
                      </div>
                      <span className="chevron">›</span>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div>
                <span
                  className="back-link"
                  onClick={() => { setSelectedStudent(null); setEditingStudent(null) }}
                >
                  ‹ Back to all students
                </span>

                <p className="detail-name">{selectedStudent}</p>

                <pre className="code-preview">
                  {submissions[selectedStudent].code}
                </pre>
                <p className="output-label">Output: {submissions[selectedStudent].output}</p>

                {editingStudent !== selectedStudent ? (
                  <button className="small-btn" onClick={() => {
                    setEditingStudent(selectedStudent)
                    setEditedCode(submissions[selectedStudent].code)
                  }}>
                    Edit Code
                  </button>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    <DiffEditor
                      height="200px"
                      original={submissions[selectedStudent].code}
                      modified={editedCode}
                      theme="vs-dark"
                      onMount={(editor) => {
                        const modifiedEditor = editor.getModifiedEditor()
                        modifiedEditor.onDidChangeModelContent(() => {
                          setEditedCode(modifiedEditor.getValue())
                        })
                      }}
                    />
                    <button className="small-btn" style={{ marginTop: '8px', marginRight: '6px' }} onClick={() => saveTeacherEdit(selectedStudent)}>
                      Save Edit
                    </button>
                    <button className="small-btn" style={{ marginTop: '8px' }} onClick={() => setEditingStudent(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

            {!joined ? (
        <div>
          {!role ? (
            <div>
              <p className="role-heading">I am a...</p>
              <div className="role-buttons">
                <button className="role-btn" onClick={() => setRole('student')}>Student</button>
                <button className="role-btn" onClick={() => setRole('instructor')}>Instructor</button>
              </div>
            </div>
          ) : role === 'student' ? (
            <div className="auth-card">
              <h3>Join a Room</h3>
              <input
                className="auth-input"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Room Code"
              />
              <input
                className="auth-input"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Your Name"
              />
              <button className="auth-btn" onClick={joinRoom}>Join</button>
              {joinError && <p className="auth-error">{joinError}</p>}
            </div>
          ) : (
            <div className="auth-card">
              <h3>Create a Room</h3>
              <input
                className="auth-input"
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Your Name"
              />

              <div className="mode-toggle">
                <button
                  className={`mode-btn ${roomMode === 'teaching' ? 'active-teaching' : ''}`}
                  onClick={() => setRoomMode('teaching')}
                >
                  Teaching Mode
                </button>
                <button
                  className={`mode-btn ${roomMode === 'assessment' ? 'active-assessment' : ''}`}
                  onClick={() => setRoomMode('assessment')}
                >
                  Assessment Mode
                </button>
              </div>

              {roomMode === 'assessment' && (
                <div>
                  {questions.map((q, index) => (
                    <div key={index} className="question-block">
                      <div className="question-block-header">
                        <p className="question-label" style={{ margin: 0 }}>Question {index + 1}</p>
                        {questions.length > 1 && (
                          <button
                            className="remove-question-btn"
                            onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      <textarea
                        className="question-textarea"
                        value={q.question_text}
                        onChange={(e) => {
                          const updated = [...questions]
                          updated[index].question_text = e.target.value
                          setQuestions(updated)
                        }}
                        placeholder="Question text"
                      />
                      <input
                        className="auth-input"
                        style={{ marginBottom: 0 }}
                        value={q.expected_output}
                        onChange={(e) => {
                          const updated = [...questions]
                          updated[index].expected_output = e.target.value
                          setQuestions(updated)
                        }}
                        placeholder="Expected output"
                      />
                    </div>
                  ))}
                  <button className="add-question-btn" onClick={() => setQuestions([...questions, { question_text: '', expected_output: '' }])}>
                    + Add Question
                  </button>
                </div>
              )}

              <button className="auth-btn" onClick={createRoom}>Create Room</button>
              {createdRoomCode && (
                <p style={{ color: 'var(--accent-green)', fontSize: '13px', marginTop: '10px' }}>
                  Room Created! Share this code: <strong>{createdRoomCode}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>

        {role === 'student' && (
        <div className="editor-shell">
          <div className="editor-header">
            <h3 className="editor-title">Code Editor</h3>
            <button
              className="help-btn"
              disabled={helpRequested}
              onClick={() => {
                if (ws) {
                  ws.send(JSON.stringify({
                    type: 'raise_hand',
                    student_name: studentName
                  }))
                  setHelpRequested(true)
                }
              }}
            >
              {helpRequested ? '✋ Help requested' : '🖐️ Need Help?'}
            </button>
          </div>

          {studentRoomMode === 'assessment' && currentQuestion && (
            <div className="question-banner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <p className="question-banner-label" style={{ margin: 0 }}>ASSESSMENT QUESTION</p>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  Question {currentQuestionIndex + 1} of {studentQuestions.length}
                </span>
              </div>
              <p className="question-banner-text">{currentQuestion.question_text}</p>
              {studentQuestions.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    className="small-btn"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(i => i - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    className="small-btn"
                    disabled={currentQuestionIndex === studentQuestions.length - 1}
                    onClick={() => setCurrentQuestionIndex(i => i + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {pendingTeacherEdit && (
            <div className="teacher-edit-notice">
              <span className="teacher-edit-text">Your instructor updated your code</span>
              <div>
                <button className="small-btn" style={{ marginRight: '6px' }} onClick={() => {
                  setCode(pendingTeacherEdit)
                  setPendingTeacherEdit(null)
                }}>
                  Apply
                </button>
                <button className="small-btn" onClick={() => setPendingTeacherEdit(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <select className="language-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="c++">C++</option>
          <option value="java">Java</option>
          </select>
          <Editor
           height="300px"
           language={language}
           value={activeCode}
           onChange={(value) => {
             if (studentRoomMode === 'assessment' && currentQuestion) {
               setQuestionCode(prev => ({ ...prev, [currentQuestion.id]: value }))
             } else {
               setCode(value)
             }
             if (ws) {
               clearTimeout(window.liveTypingTimeout)
               window.liveTypingTimeout = setTimeout(() => {
                 ws.send(JSON.stringify({
                   type: 'live_code',
                   student_name: studentName,
                   code: value
                 }))
               }, 800)
             }
           }}
           theme="vs-dark"
         />
          <button className="run-btn" onClick={runCode} disabled={running}>
            {running ? 'Running...' : 'Run'}
          </button>
          <pre className="output-box">
            {output}
          </pre>
          {studentRoomMode === 'assessment' && currentQuestion && questionResults[currentQuestion.id] !== undefined && (
            <p className={questionResults[currentQuestion.id] ? 'result-correct' : 'result-incorrect'}>
              {questionResults[currentQuestion.id] ? '✅ Correct!' : '❌ Incorrect, try again'}
            </p>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default App
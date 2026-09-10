import { useState, useEffect } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'

function App() {
  const [message, setMessage] = useState('Loading...')
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
  const [submissions, setSubmissions] = useState({})
  const [editingStudent, setEditingStudent] = useState(null)
  const [editedCode, setEditedCode] = useState('') 

    useEffect(() => {
    fetch('http://127.0.0.1:8000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Error: backend not reachable'))
  }, [])

    useEffect(() => {
    if (!joined) return

    const activeRoomCode = role === 'student' ? roomCode : createdRoomCode
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/${activeRoomCode}`)
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'submission') {
          setSubmissions(prev => ({
            ...prev,
            [parsed.student_name]: { code: parsed.code, output: parsed.output }
          }))
        } else {
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
        setJoined(true)
      }
    } catch (err) {
      setJoinError('Could not reach backend')
    }
}

const createRoom = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/create-room?instructor_name=${instructorName}`, {
        method: 'POST'
      })
      const data = await res.json()
      setCreatedRoomCode(data.room_code)
      setJoined(true)
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
      setEditingStudent(null)
    } catch (err) {
      console.error('Could not save edit')
    }
}

  const runCode = async () => {
    setRunning(true)
    setOutput('Running...')
    try {
            const res = await fetch('http://127.0.0.1:8000/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            code,
            language,
            student_name: role === 'student' ? studentName : instructorName,
            room_code: role === 'student' ? roomCode : createdRoomCode
        })
      })

      const data = await res.json()
      setOutput(data.output || data.stderr || 'No output')

          if (ws && role === 'student') {
          ws.send(JSON.stringify({
          type: 'submission',
          student_name: studentName,
          code: code,
          output: data.output || data.stderr || 'No output'
        }))
      }
    } catch (err) {
      setOutput('Error: could not reach backend')
    }
    setRunning(false)
  }

    return (
    <div>
      <h1>Dev-Arena</h1>
      <p>{message}</p>
                {joined && role === 'instructor' && (
        <div>
          <p style={{ textAlign: 'center', fontSize: '18px' }}>
            Room Code: <strong>{createdRoomCode}</strong>
          </p>

          <h3 style={{ textAlign: 'center' }}>Live Student Submissions</h3>
          {Object.keys(submissions).length === 0 ? (
            <p style={{ textAlign: 'center' }}>No submissions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                            {Object.entries(submissions).map(([name, sub]) => (
                <div key={name} style={{ border: '1px solid #444', padding: '10px', width: '300px' }}>
                  <strong>{name}</strong>
                  <pre style={{ background: '#1e1e1e', color: '#0f0', padding: '8px', overflowX: 'auto' }}>
                    {sub.code}
                  </pre>
                  <p>Output: {sub.output}</p>
                  <button onClick={() => {
                    setEditingStudent(name)
                    setEditedCode(sub.code)
                  }}>
                    Edit Code
                  </button>

                  {editingStudent === name && (
                    <div style={{ marginTop: '10px' }}>
                      <DiffEditor
                        height="200px"
                        original={sub.code}
                        modified={editedCode}
                        theme="vs-dark"
                        onMount={(editor) => {
                          const modifiedEditor = editor.getModifiedEditor()
                          modifiedEditor.onDidChangeModelContent(() => {
                            setEditedCode(modifiedEditor.getValue())
                          })
                        }}
                      />
                      <button onClick={() => saveTeacherEdit(name)} style={{ marginTop: '5px' }}>
                        Save Edit
                      </button>
                      <button onClick={() => setEditingStudent(null)} style={{ marginTop: '5px', marginLeft: '5px' }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

            {!joined ? (
        <div>
          {!role ? (
            <div>
              <h3>I am a...</h3>
              <button onClick={() => setRole('student')}>Student</button>
              <button onClick={() => setRole('instructor')}>Instructor</button>
            </div>
          ) : role === 'student' ? (
            <div>
              <h3>Join a Room</h3>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Room Code"
              />
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Your Name"
              />
              <button onClick={joinRoom}>Join</button>
              {joinError && <p style={{ color: 'red' }}>{joinError}</p>}
            </div>
          ) : (
            <div>
              <h3>Create a Room</h3>
              <input
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Your Name"
              />
              <button onClick={createRoom}>Create Room</button>
              {createdRoomCode && (
                <p>Room Created! Share this code: <strong>{createdRoomCode}</strong></p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>

      <hr />
      <h3>WebSocket Live Test</h3>
      <input
        value={liveText}
        onChange={(e) => setLiveText(e.target.value)}
        placeholder="Type something..."
      />
      <button onClick={sendMessage}>Send</button>
      <p>Received live: <strong>{received}</strong></p>

      <hr />
      <h3>Code Editor (Monaco + Piston)</h3>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ marginBottom: '10px' }}>
      <option value="python">Python</option>
      <option value="c">C</option>
      <option value="c++">C++</option>
      <option value="java">Java</option>
      </select>
      <Editor
       height="300px"
       language={language}
       value={code}
       onChange={(value) => setCode(value)}
       theme="vs-dark"
     />
      <button onClick={runCode} disabled={running} style={{ marginTop: '10px' }}>
        {running ? 'Running...' : 'Run'}
      </button>
      <pre style={{ background: '#1e1e1e', color: '#0f0', padding: '10px', marginTop: '10px' }}>
        {output}
            </pre>
        </>
      )}
    </div>
  )
}

export default App
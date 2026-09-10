import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

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

  useEffect(() => {
    fetch('http://127.0.0.1:8000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Error: backend not reachable'))

    const socket = new WebSocket('ws://127.0.0.1:8000/ws')
    socket.onmessage = (event) => {
      setReceived(event.data)
    }
    setWs(socket)

    return () => socket.close()
  }, [])

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

  const runCode = async () => {
    setRunning(true)
    setOutput('Running...')
    try {
      const res = await fetch('http://127.0.0.1:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      })
      const data = await res.json()
      setOutput(data.output || data.stderr || 'No output')
    } catch (err) {
      setOutput('Error: could not reach backend')
    }
    setRunning(false)
  }

    return (
    <div>
      <h1>Dev-Arena</h1>
      <p>{message}</p>

      {!joined ? (
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
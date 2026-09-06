import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

function App() {
  const [message, setMessage] = useState('Loading...')
  const [liveText, setLiveText] = useState('')
  const [received, setReceived] = useState('')
  const [ws, setWs] = useState(null)
  const [code, setCode] = useState('print("Hello, Dev-Arena!")')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)

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

  const runCode = async () => {
    setRunning(true)
    setOutput('Running...')
    try {
      const res = await fetch('http://127.0.0.1:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' })
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
      <Editor
        height="300px"
        defaultLanguage="python"
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
    </div>
  )
}

export default App
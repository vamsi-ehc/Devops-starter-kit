import { useEffect, useState } from 'react'

export default function Home() {
  const [todos, setTodos] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchTodos() {
    setLoading(true)
    try {
      const res = await fetch('/api/todos')
      const data = await res.json()
      setTodos(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  async function addTodo(e) {
    e.preventDefault()
    if (!text.trim()) return
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    const newTodo = await res.json()
    setTodos((s) => [...s, newTodo])
    setText('')
  }

  async function toggleDone(id, done) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done })
    })
    const updated = await res.json()
    setTodos((s) => s.map((t) => (t.id === id ? updated : t)))
  }

  async function removeTodo(id) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    setTodos((s) => s.filter((t) => t.id !== id))
  }

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', maxWidth: 720, margin: '40px auto' }}>
      <h1>Next.js ToDo (demo)</h1>

      <form onSubmit={addTodo} style={{ marginBottom: 20 }}>
        <input
          placeholder="Write a todo and press Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ padding: '8px 12px', width: '70%' }}
        />
        <button style={{ marginLeft: 8, padding: '8px 12px' }} type="submit">
          Add
        </button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {todos.map((t) => (
            <li key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={!!t.done} onChange={() => toggleDone(t.id, t.done)} />
                <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button style={{ marginLeft: 'auto' }} onClick={() => removeTodo(t.id)}>
                  Delete
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}

      <footer style={{ marginTop: 24, color: '#666' }}>Simple Devops CI/CD demo for Next js— persists to <code>data/db.json</code></footer>
    </main>
  )
}

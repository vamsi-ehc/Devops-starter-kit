import { readDB, writeDB } from '../../../lib/db'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const db = await readDB()
    return res.status(200).json(db.todos)
  }

  if (req.method === 'POST') {
    const { text } = req.body
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' })

    const db = await readDB()
    const id = Date.now().toString()
    const todo = { id, text, done: false, createdAt: new Date().toISOString() }
    db.todos.push(todo)
    await writeDB(db)
    return res.status(201).json(todo)
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).end('Method Not Allowed')
}

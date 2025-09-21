import { readDB, writeDB } from '../../../lib/db'

export default async function handler(req, res) {
  const { id } = req.query
  const db = await readDB()
  const idx = db.todos.findIndex((t) => t.id === id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  if (req.method === 'GET') {
    return res.status(200).json(db.todos[idx])
  }

  if (req.method === 'PUT') {
    const { text, done } = req.body
    if (text !== undefined) db.todos[idx].text = text
    if (done !== undefined) db.todos[idx].done = !!done
    db.todos[idx].updatedAt = new Date().toISOString()
    await writeDB(db)
    return res.status(200).json(db.todos[idx])
  }

  if (req.method === 'DELETE') {
    const [removed] = db.todos.splice(idx, 1)
    await writeDB(db)
    return res.status(200).json(removed)
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  res.status(405).end('Method Not Allowed')
}

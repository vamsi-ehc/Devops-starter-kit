import fs from 'fs/promises'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

async function ensureDB() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  try {
    await fs.access(DB_PATH)
  } catch (e) {
    await fs.writeFile(DB_PATH, JSON.stringify({ todos: [] }, null, 2), 'utf8')
  }
}

export async function readDB() {
  await ensureDB()
  const raw = await fs.readFile(DB_PATH, 'utf8')
  return JSON.parse(raw)
}

export async function writeDB(data) {
  await ensureDB()
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}

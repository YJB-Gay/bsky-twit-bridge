import fs from 'fs'
import type { Post } from './post'
import { promisify } from 'util'
import * as dotenv from 'dotenv'

dotenv.config()

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const DATA_FILE = process.env.DATA_FILE || './posts.json'

export async function getPosts(): Promise<Post[]> {
    try {
        const data = await readFile(DATA_FILE)
        const posts: Post[] = JSON.parse(data.toString())
        return posts
    } catch (err) {
        return []
    }
}

export async function writePosts(posts: Post[]) {
    await writeFile(DATA_FILE, JSON.stringify(posts))
}
import fs from 'fs'
import * as config from "./config.json"
import type { Post } from './post'
import { promisify } from 'util' 

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

export async function getPosts(): Promise<Post[]> {
    try {
        const data = await readFile(config.datafile)
        const posts: Post[] = JSON.parse(data.toString())
        return posts
    } catch (err) {
        console.error("Error when reading the file!")
        return []
    }
}

export async function writePosts(posts: Post[]) {
    await writeFile(config.datafile, JSON.stringify(posts))
}
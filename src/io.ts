import fs from 'fs/promises'
import * as config from "./config.json"
import type { Post } from './post'

async function getPosts() {
    await fs.readFile(config.datafile).then(data => {
        const posts: Post[] = JSON.parse(data.toString()).posts
        return posts
    }).catch(err => {
        return []
    })
}

async function writePosts(posts: Post[]) {
    await fs.writeFile(config.datafile, JSON.stringify(posts))
}
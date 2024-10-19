import { BskyAgent } from "@atproto/api"
import * as dotenv from "dotenv"
import Parser from "rss-parser"
import { parseDescription } from "./util"
import * as io from "./io"
import type { Post } from "./post"

import * as config from "./config.json"

dotenv.config()

type CustomFeed = { title: string }
type CustomItem = { description: string }

const parser: Parser<CustomFeed, CustomItem> = new Parser({
    customFields: {
        feed: ['title'],
        item: ['description']
    }
})

const agent = new BskyAgent({
    service: 'https://bsky.social'
})

await agent.login({ identifier: process.env.BSKY_USERNAME!, password: process.env.BSKY_PASSWORD! })

async function checkNewPosts() {
    const savedPosts = await io.getPosts()

    const feed = await parser.parseURL(`https://nitter.poast.org/${config.user}/rss`)
    const latestPost = feed.items[0]

    if (savedPosts && savedPosts.length > 0) {
        const latestSavedPost = savedPosts[savedPosts.length - 1]

        if (latestSavedPost.guid == latestPost.guid?.split('/')[5]) {
            console.log("No new posts!")
            return
        }
    }

    const desc = parseDescription(latestPost.description)
    const newPost = { description: desc.desc, guid: latestPost.guid?.split('/')[5]!, images: desc.images }
    await pushPost(newPost)
    savedPosts.push(newPost)
    await io.writePosts(savedPosts)
}

async function pushPost(post: Post) {
    console.log('NEW POST')
    console.log(`${post.description}\n${post.guid}\n${post.images?.join('\n')}`)

    await agent.post({
        text: `${post.description}`,
        createdAt: new Date().toISOString()
    })
}

await (async () => {
    await checkNewPosts()
})()
import { BskyAgent } from "@atproto/api"
import * as dotenv from "dotenv"
import Parser from "rss-parser"
import { parseDescription } from "./util"
import * as io from "./io"
import type { Post } from "./post"
import axios from 'axios'

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

    const feed = await parser.parseURL(`https://nitter.privacydev.net/${config.user}/rss`)
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

async function fetchImageAsUint8Array(url: string) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // Mimic a real browser
        }
    });
    return [new Uint8Array(response.data), response.headers["Content-Type"]?.toString()];
}

async function pushPost(post: Post) {
    console.log('NEW POST')
    console.log(`${post.description}\n${post.guid}\n${post.images?.join('\n')}`)

    let images = []
    if (post.images) {    
        for (const image of post.images!) {
            const [imageArray, encoding] = await fetchImageAsUint8Array(image);

            const { data } = await agent.uploadBlob(imageArray as Uint8Array, {
                encoding: encoding as string,
            });

            images.push(
                {
                    alt: '',
                    image: data.blob,
                }
            )
        }
    }

    await agent.post({
        text: `${post.description}`,
        embed: {
            $type: 'app.bsky.embed.images',
            images: images
        },
        createdAt: new Date().toISOString()
    })
}

setInterval(
    checkNewPosts
, 10000)
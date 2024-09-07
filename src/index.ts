import { BskyAgent } from "@atproto/api"
import * as dotenv from "dotenv"
import Parser from "rss-parser"
import { parseDescription } from "./util"

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

// await agent.login({ identifier: process.env.BLUESKY_USERNAME!, password: process.env.BLUESKY_PASSWORD! })

await (async () => {
    const feed = await parser.parseURL(`https://nitter.poast.org/${config.user}/rss`)

    const item = feed.items[0]
    const desc = parseDescription(item.description)
    console.log(`${desc.desc}\n${desc.img}`)
})()
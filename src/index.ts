import { BskyAgent } from "@atproto/api"
import * as dotenv from "dotenv"
import { buildRichText } from "./util"
import * as io from "./io"
import type { Post } from "./post"
import axios from 'axios'
import { getUserTweets } from "./twitter"
import { compressVideo } from "./video"
import * as fs from 'fs'

dotenv.config()

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')

const BSKY_USERNAME = process.env.BSKY_USERNAME!
const BSKY_PASSWORD = process.env.BSKY_PASSWORD!
const TWITTER_USER = process.env.TWITTER_USER!
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '60000')

if (!BSKY_USERNAME || !BSKY_PASSWORD || !TWITTER_USER) {
    console.error('missing env vars')
    process.exit(1)
}

const agent = new BskyAgent({
    service: 'https://bsky.social'
})

await agent.login({ identifier: BSKY_USERNAME, password: BSKY_PASSWORD })

async function checkNewPosts() {
    const savedPosts = await io.getPosts()
    
    try {
        const tweets = await getUserTweets(TWITTER_USER, 5)
        if (!tweets || tweets.length === 0) return
        
        const latestTweet = tweets[0]
        
        if (savedPosts && savedPosts.length > 0) {
            const latestSavedPost = savedPosts[savedPosts.length - 1]
            if (latestSavedPost.guid === latestTweet.id) {
                console.log("no new posts")
                return
            }
        }
        
        const media = latestTweet.media.map(m => ({
            type: m.type === 'video' ? 'video' as const : 'photo' as const,
            url: m.url
        }))
        
        let text = latestTweet.text.replace(/https:\/\/t\.co\/\w+/g, '').trim()
        const newPost = { 
            description: text, 
            guid: latestTweet.id, 
            media 
        }
        
        await pushPost(newPost)
        savedPosts.push(newPost)
        await io.writePosts(savedPosts)
    } catch (error) {
        console.error('error checking tweets:', error)
    }
}

async function fetchImageAsUint8Array(url: string): Promise<[Uint8Array, string] | null> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        })
        const contentType = response.headers["content-type"]?.toString() || ''
        if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
            return null
        }
        return [new Uint8Array(response.data), contentType]
    } catch (error) {
        return null
    }
}

async function pushPost(post: Post) {


    const images = []
    let videoEmbed = null

    if (post.media) {
        const firstVideo = post.media.find(m => m.type === 'video')
        if (firstVideo) {
            try {
                const videoPath = `./temp/${post.guid}.mp4`
                await compressVideo(firstVideo.url, videoPath)
                const videoData = fs.readFileSync(videoPath)
                const videoSize = videoData.length
                const didDoc = await agent.com.atproto.identity.resolveHandle({ handle: agent.session?.handle || '' })
                const userDid = didDoc.data.did
                const didDocResponse = await fetch(`https://plc.directory/${userDid}`)
                const didDocData = await didDocResponse.json() as any
                const pdsEndpoint = didDocData.service?.find((s: any) => s.id === '#atproto_pds')?.serviceEndpoint
                const pdsHost = new URL(pdsEndpoint).host
                const serviceAuth = await agent.com.atproto.server.getServiceAuth({
                    aud: `did:web:${pdsHost}`,
                    lxm: 'com.atproto.repo.uploadBlob',
                    exp: Math.floor(Date.now() / 1000) + 60 * 30,
                })
                const uploadUrl = new URL('https://video.bsky.app/xrpc/app.bsky.video.uploadVideo')
                uploadUrl.searchParams.append('did', agent.session?.did || '')
                uploadUrl.searchParams.append('name', `${post.guid}.mp4`)
                const uploadResponse = await fetch(uploadUrl.toString(), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceAuth.data.token}`,
                        'Content-Type': 'video/mp4',
                        'Content-Length': videoSize.toString()
                    },
                    body: new Uint8Array(videoData)
                })
                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text()
                    throw new Error(`Video upload failed: ${uploadResponse.status}`)
                }
                const jobStatus = await uploadResponse.json() as any
                let blob = jobStatus.blob
                let attempts = 0
                const maxAttempts = 60
                while (!blob && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    attempts++
                    const statusResponse = await fetch(
                        `https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${jobStatus.jobId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${serviceAuth.data.token}`
                            }
                        }
                    )
                    const status = await statusResponse.json() as any
                    if (status.jobStatus?.blob) {
                        blob = status.jobStatus.blob
                    }
                    if (status.jobStatus?.state === 'JOB_STATE_FAILED') {
                        throw new Error('Video processing failed')
                    }
                }
                if (!blob) {
                    throw new Error('Video processing timed out')
                }
                videoEmbed = {
                    $type: 'app.bsky.embed.video',
                    video: blob,
                    alt: post.description.slice(0, 1000)
                }
                try { fs.unlinkSync(videoPath); } catch {}
            } catch (error) {
                // video upload failed
            }
        } else {
            for (const item of post.media) {
                if (images.length >= 4) break
                try {
                    if (item.type === 'photo') {
                        const result = await fetchImageAsUint8Array(item.url)
                        if (result) {
                            const [imageArray, encoding] = result
                            const { data } = await agent.uploadBlob(imageArray, { encoding })
                            images.push({ 
                                alt: '', 
                                image: data.blob
                            })
                        }
                    }
                } catch (error) {
                    // image upload failed
                }
            }
        }
    }

    const rt = await buildRichText(post.description, agent)

    let embed = undefined
    if (videoEmbed) {
        embed = videoEmbed
    } else if (images.length > 0) {
        embed = {
            $type: 'app.bsky.embed.images',
            images: images
        }
    }
    
    const postResult = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed,
        createdAt: new Date().toISOString()
    })
    

}

setInterval(checkNewPosts, CHECK_INTERVAL)
import HTMLParser from "node-html-parser"
import { RichText, AppBskyRichtextFacet, BskyAgent } from "@atproto/api"

export function parseDescription(description: string, instance: string) {
    const descElem = HTMLParser.parse(description)
    const imageElems = descElem.getElementsByTagName('img')
    const videoElems = descElem.getElementsByTagName('video')
    const links = descElem.getElementsByTagName('a')

    const media = []
    
    for (const image of imageElems) {
        let src = image.attributes['src']
        if (src) {
            if (src.startsWith('/')) {
                src = `https://${instance}${src}`
            }
            media.push({ type: 'image', url: src })
        }
    }
    
    for (const video of videoElems) {
        let poster = video.attributes['poster'] || video.querySelector('source')?.attributes['src']
        if (poster) {
            if (poster.startsWith('/')) {
                poster = `https://${instance}${poster}`
            }
            media.push({ type: 'image', url: poster })
        }
    }

    for (const image of imageElems) {
        image.remove()
    }
    for (const video of videoElems) {
        video.remove()
    }

    let desc = descElem.textContent || ''
    desc = desc.trim()

    return { desc, media }
}

export async function buildRichText(text: string, agent: BskyAgent) {
    const rt = new RichText({ text })
    await rt.detectFacets(agent)
    return rt
}

export async function extractMediaFromTweet(tweetUrl: string, instance: string) {
    const axios = require('axios')
    const media = []
    let text = ''
    
    try {
        const response = await axios.get(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        })
        
        const html = response.data
        const doc = HTMLParser.parse(html)
        
        const tweetContent = doc.querySelector('.tweet-content')
        if (tweetContent) {
            const links = tweetContent.querySelectorAll('a')
            for (const link of links) {
                const href = link.getAttribute('href')
                if (href && !href.includes('/search?q=')) {
                    link.replaceWith(link.textContent)
                }
            }
            text = tweetContent.textContent.trim()
        }
        
        const attachments = doc.querySelectorAll('.attachments .still-image img, .attachments .attachment-image img')
        for (const img of attachments) {
            let src = img.getAttribute('src')
            if (src) {
                if (src.startsWith('/')) {
                    src = `https://${instance}${src}`
                }
                media.push({ type: 'image', url: src })
            }
        }
        
        const videos = doc.querySelectorAll('.attachments video')
        for (const vid of videos) {
            let poster = vid.getAttribute('poster')
            if (poster) {
                if (poster.startsWith('/')) {
                    poster = `https://${instance}${poster}`
                }
                media.push({ type: 'image', url: poster })
            }
        }
        
        if (text === '' && media.length === 0) {
            console.error('no content found on page, html preview:', html.substring(0, 500))
        }
    } catch (error) {
        console.error('failed to fetch tweet page:', error)
    }
    
    return { text, media }
}
import HTMLParser from "node-html-parser"

export function parseDescription(description: string) {
    const descElem = HTMLParser.parse(description)
    const imageElems = descElem.getElementsByTagName('img')
    const links = descElem.getElementsByTagName('a')

    const images = []

    let desc = descElem.getElementsByTagName('p')[0].innerHTML
        .replaceAll('<br>', '\n')
    
    for (const link of links) {
        desc = desc.replaceAll(link.outerHTML, link.innerText)
    }
    for (const image of imageElems) {
        desc = desc.replaceAll(image.outerHTML, '')
        images.push(image.attributes['src'])
    }

    return { desc, images }
}
import HTMLParser from "node-html-parser"

export function parseDescription(description: string) {
    const descElem = HTMLParser.parse(description)
    const imageElems = descElem.getElementsByTagName('img')

    const desc = descElem.getElementsByTagName('p')[0].removeChild(imageElems[0]).innerHTML
        .replaceAll('<br>', '\n')
    const img = imageElems[0].attributes['src']

    return { desc, img }
}
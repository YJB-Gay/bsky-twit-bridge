export interface Post {
    description: string,
    guid: string,
    media?: Array<{ type: string, url: string }>
}
import sys
import json
import asyncio
from twikit import Client

async def get_user_tweets(username, count=10):
    client = Client('en-US')
    
    # Try to load cookies if they exist
    try:
        client.load_cookies('cookies.json')
    except:
        print(json.dumps({"error": "Not logged in. Run login script first."}))
        return
    
    try:
        # Get user by screen name to get user ID
        user = await client.get_user_by_screen_name(username)
        user_id = user.id
        
        tweets_data = []
        tweets = await client.get_user_tweets(user_id, 'Tweets', count=count)
        
        for tweet in tweets:
            # Skip retweets
            if tweet.text.startswith('RT @'):
                continue
            
            media = []
            if tweet.media:
                for m in tweet.media:
                    media_url = None
                    media_type = m.type
                    
                    # For photos, use media_url
                    if hasattr(m, 'media_url'):
                        media_url = m.media_url
                    
                    # For videos, try to get the best quality video URL
                    if media_type == 'video' and hasattr(m, 'streams') and m.streams:
                        # Get the highest bitrate stream
                        best_stream = max(m.streams, key=lambda s: s.bitrate if hasattr(s, 'bitrate') and s.bitrate else 0)
                        if hasattr(best_stream, 'url'):
                            media_url = best_stream.url
                    
                    if media_url:
                        media.append({
                            'type': media_type,
                            'url': media_url
                        })
            
            tweets_data.append({
                'id': tweet.id,
                'text': tweet.text,
                'media': media,
                'created_at': tweet.created_at
            })
        
        print(json.dumps(tweets_data))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else None
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    if not username:
        print(json.dumps({"error": "Username required"}))
        sys.exit(1)
    
    asyncio.run(get_user_tweets(username, count))

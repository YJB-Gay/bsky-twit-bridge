export interface TweetData {
  id: string;
  text: string;
  media: Array<{
    type: string;
    url: string;
  }>;
  created_at: string;
}

export async function getUserTweets(username: string, count: number = 10): Promise<TweetData[]> {
  const proc = Bun.spawn(['python', 'get_tweets.py', username, count.toString()], {
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error(`Python script exited with code ${proc.exitCode}: ${stderr}`);
  }

  try {
    const result = JSON.parse(stdout);
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${stdout}`);
  }
}

// Redis pub/sub fan-out across server instances, one channel per active
// room. A subscriber connection in ioredis can't also issue normal commands,
// so this owns a second, dedicated connection distinct from
// infra/redis/client.js (which rate-limit.middleware.js already uses for
// plain commands) -- publishing can reuse that shared client.
const Redis = require('ioredis');
const redis = require('../../infra/redis/client.js');

const subscriber = new Redis(process.env.REDIS_URL);
const handlers = new Map(); // channel -> handler(Buffer)

subscriber.on('messageBuffer', (channelBuffer, messageBuffer) => {
  const handler = handlers.get(channelBuffer.toString());
  handler?.(messageBuffer);
});

async function publish(channel, buffer) {
  await redis.publish(channel, buffer);
}

async function subscribe(channel, handler) {
  handlers.set(channel, handler);
  await subscriber.subscribe(channel);
}

async function unsubscribe(channel) {
  handlers.delete(channel);
  await subscriber.unsubscribe(channel);
}

module.exports = { publish, subscribe, unsubscribe };

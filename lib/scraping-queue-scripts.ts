// Todos os scripts recebem: ready, processing, results, leases, delayed, scanCursor.
// TIME do Redis evita divergências entre relógios dos workers.
const prelude = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local function finish(job, result)
  redis.call('HSET', KEYS[3], job.id, cjson.encode(result))
  redis.call('EXPIRE', KEYS[3], 86400)
  redis.call('HDEL', KEYS[2], job.id)
  redis.call('ZREM', KEYS[4], job.id)
end
local function retry(job, message)
  if job.attempts >= job.maxAttempts then
    finish(job, {jobId=job.id, success=false, error=message, completedAt=now})
  else
    job.claimToken = nil
    job.leaseUntil = nil
    redis.call('ZADD', KEYS[5], now + math.min(1000 * 2^job.attempts, 60000), cjson.encode(job))
    redis.call('HDEL', KEYS[2], job.id)
    redis.call('ZREM', KEYS[4], job.id)
  end
end
`;

export const CLAIM_JOB = prelude + `
-- Recupera também claims anteriores à introdução de leases, em lotes limitados.
local cursor = redis.call('GET', KEYS[6]) or '0'
local scan = redis.call('HSCAN', KEYS[2], cursor, 'COUNT', 50)
redis.call('SET', KEYS[6], scan[1])
for i=1,#scan[2],2 do
  local job = cjson.decode(scan[2][i+1])
  if not job.leaseUntil then redis.call('ZADD', KEYS[4], 0, job.id) end
end
for _,id in ipairs(redis.call('ZRANGEBYSCORE', KEYS[4], '-inf', now, 'LIMIT', 0, 50)) do
  local raw = redis.call('HGET', KEYS[2], id)
  if raw then retry(cjson.decode(raw), 'Lease expirado; worker abandonou o job')
  else redis.call('ZREM', KEYS[4], id) end
end
for _,raw in ipairs(redis.call('ZRANGEBYSCORE', KEYS[5], '-inf', now, 'LIMIT', 0, 50)) do
  local job = cjson.decode(raw)
  redis.call('ZADD', KEYS[1], -job.priority, raw)
  redis.call('ZREM', KEYS[5], raw)
end
local next = redis.call('ZRANGE', KEYS[1], 0, 0)
if #next == 0 then return nil end
local job = cjson.decode(next[1])
job.attempts = job.attempts + 1
job.claimToken = ARGV[1]
job.leaseUntil = now + tonumber(ARGV[2])
local raw = cjson.encode(job)
redis.call('HSET', KEYS[2], job.id, raw)
redis.call('ZADD', KEYS[4], job.leaseUntil, job.id)
redis.call('ZREM', KEYS[1], next[1])
return raw
`;

const ownership = `
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local job = cjson.decode(raw)
if job.claimToken ~= ARGV[2] or job.leaseUntil <= now then return 0 end
`;

export const COMPLETE_JOB = prelude + ownership + `
finish(job, cjson.decode(ARGV[3]))
return 1
`;
export const FAIL_JOB = prelude + ownership + `
retry(job, ARGV[3])
return 1
`;
export const RENEW_JOB = prelude + ownership + `
job.leaseUntil = now + tonumber(ARGV[3])
redis.call('HSET', KEYS[2], job.id, cjson.encode(job))
redis.call('ZADD', KEYS[4], job.leaseUntil, job.id)
return 1
`;

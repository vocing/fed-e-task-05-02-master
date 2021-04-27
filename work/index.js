const ioredis = require('ioredis')
const express = require('express')
const uuidv4 = require('uuid').v4

const redis = new ioredis(6379)
const app = express()

app.use(express.json())

// 检测type类型并返回数据库id
function validateType({ type, res, operate = 'get' }) {
  return new Promise(async (resolve) => {
    let types = {
      male: 1,
      female: 0
    }
    // 如果是获取漂流瓶时候的校验, 则有all
    if (operate === 'get') {
      types.all = Math.round(Math.random())
    }

    const typeCode = types[type]
    if (typeCode === undefined) {
      res.status(200).json({
        "code": 0,
        "msg": '漂流瓶类型错误'
      })
      return
    }

    resolve({ typeCode, otherCode: typeCode ^ 1 })
  })
}

app.get('/', async (req, res, next) => {
  try {
    const { user, type = 'all' } = req.query
    const { typeCode, otherCode } = await validateType({ type, res })

    if (!user) {
      res.status(200).json({
        "code": 0,
        "msg": 'user不能为空'
      })
      return
    }
    await redis.select(typeCode)
    let bottleId = await redis.randomkey()
    // 当前库没有漂流瓶, 且type为all, 则再切库重取
    if (!bottleId && type === 'all') {
      await redis.select(otherCode)
      bottleId = await redis.randomkey()
    }
    if (!bottleId) {
      res.status(200).json({
        "code": 0,
        "msg": "噢偶，漂流瓶已经被打捞完了"
      })
    } else {
      const result = await redis.hgetall(bottleId)
      redis.del(bottleId)
      res.status(200).json({
        "code": 1,
        "msg": result
      })
    }
  } catch (err) {
    next(err)
  }
})

app.post('/', async (req, res, next) => {
  try {
    const { time, owner, type = 'all', content = '' } = req.query
    const { typeCode } = await validateType({ type, res, operate: 'post' })
    await redis.select(typeCode)

    if (!owner) {
      res.status(200).json({
        "code": 0,
        "msg": 'owner不能为空'
      })
      return
    }

    const bottleId = uuidv4()
    const data = {
      time,
      owner,
      type,
      content
    }
    await redis.hmset(bottleId, data)

    res.status(200).json({
      "code": 1,
      "msg": '漂流瓶已成功扔出'
    })
  } catch (err) {
    next(err)
  }
})

app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).json({
    "code": 0,
    msg: err.message
  })
})

app.listen(3000, () => {
  console.log(`app is running in localhost:3000`)
})
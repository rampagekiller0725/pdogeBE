const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb")
const bodyParser = require("body-parser");
const cors = require("cors");
const { Item, Social, User } = require("./model.js");
const { addHours } = require("date-fns");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const { startOfWeek, endOfWeek } = require('date-fns');
const price = [5000, 8000, 14000, 20000, 30000, 60000, 100000, 200000, 500000, 1000000];

require("dotenv").config();

// Initialize express app
const app = express();
const port = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;
// const baseFrontendUrl = "https://pdoge-kombat.vercel.app"
// const baseFrontendUrl = "http://209.74.66.139:5173";
// const baseFrontendUrl = "http://game.physicaldoge.xyz";
const baseFrontendUrl = "https://game.physicaldoge.xyz"
const baseBackendUrl = "https://tap-squad-back.vercel.app"

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: [baseFrontendUrl, "https://paladin-ai-tap-front-git-development-lighteros-projects.vercel.app"], // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// MongoDB connection
const dbURI = process.env.DB_URI;
// const dbURI = 'mongodb://127.0.0.1:27017/test'
mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    insertItems();
  })
  .catch((err) => console.log(err));

// Define schema and model
const authorizeBearerToken = async (request, response, next) => {
  try {
    const token = request.headers.authorization && request.headers.authorization.split(' ')[1];

    if (!token) {
      return response.status(400).json({
        message: 'Token not provided',
      })
    }
    else {
      const auth = jwt.verify(token, JWT_SECRET)
      if (!auth) {
        return response.status(401).json({
          message: 'Unauthorized - invalid token',
        })
      }

      request.auth = auth
      request.body.userId = auth.userId
      next()
    }
  } catch (error) {
    console.error('Error occured here: ', error);
    return response.status(401).json({
      message: 'Unauthorized - invalid token',
    })
  }
}
// Routes
app.get("/items", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (item == null) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/items", async (req, res) => {
  const { user } = req.body;
  console.log(user);
  let item = await Item.findOne({ t_id: user });

  if (!item) {
    item = new Item({ t_id: user, t_name: "hello", mount: 0 });
    item
      .save()
      .then(() => {
        return res.json({ stats: "success", item });
      })
      .catch(() => {
        return res.json({ stats: "error" });
      });
  } else return res.json({ stats: "success", item });
  // res.json(item);
});

app.post('/friends', async (req, res) => {
  const { user } = req.body;
  let items = await Item.find({ t_friend_id: user });
  if (items.length == 0) {
    return res.json({ stats: "no friend found" })
  }
  else return res.json({ stats: "success", items })
  // res.json(item);
});

app.post('/getItem', async (req, res) => {
  try {
    const { t_id, data } = req.body

    if (!t_id) {
      return res.status(400).json({
        message: "Telegram ID required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let balance = user.balance + data.count;
    let totalEarned = user.totalEarned + data.count;
    user.balance = balance;
    user.totalEarned = totalEarned;

    await user.save();

    const userLevel = getUserLevel(totalEarned);

    return res.status(200).json({
      message: "Successfully logged in",
      data: user,
      userLevel
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/boost', async (req, res) => {
  try {
    const { t_id } = req.body;
    if (!t_id) {
      return res.status(400).json({
        message: "Telegram ID required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let currentTime = new Date();
    if (user.boost_timestamp != undefined) {
      let boostedTime = new Date(user.boost_timestamp);
      let roundedHours = (currentTime - boostedTime) / 3600000;
      console.log(currentTime, boostedTime);
      console.log(roundedHours);
      if (roundedHours < 24) {
        return res.status(400).json({
          message: "You can boost after 24 hours."
        });
      }        
    }
    
    user.boost_timestamp = currentTime;
    await user.save();

    return res.status(200).json({
      message: "Successfully boosted",
      energy: user.energy
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
app.post('/update-item', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        message: "Item ID required.",
      });
    }
    const item = await Item.findOne({ _id: new ObjectId(id.toString()) });
    if (!item) {
      return res.status(400).json({
        message: "Item is not founded.",
      });
    }
    item.item_level++;
    item.cost *= 1.5;
    item.passive_income *= 1.5;
    await item.save();

    return res.status(200).json({
      message: "Success"
    });

  } catch (e) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/upgrade-tap', async (req, res) => {
  try {
    const { t_id } = req.body

    if (!t_id) {
      return res.status(400).json({
        message: "Telegram ID required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.earnPerTap === 10) {
      return res.status(400).json({
        message: "Already Max level"
      })
    }

    const balance = user.balance;

    if (balance < price[user.earnPerTap - 1]) {
      return res.status(400).json({
        message: "Your balance is not enough.",
      });
    }

    const earnPerTap = user.earnPerTap;

    user.balance = balance - price[user.earnPerTap - 1];
    user.earnPerTap = earnPerTap + 1;
    await user.save();

    const userLevel = getUserLevel(user.totalEarned);

    return res.status(200).json({
      message: "Successfully upgraded",
      data: user,
      userLevel
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/upgrade-energy', async (req, res) => {
  try {
    const { t_id } = req.body

    if (!t_id) {
      return res.status(400).json({
        message: "Telegram ID required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const balance = user.balance;

    if (balance < price[user.energy / 500 - 1]) {
      return res.status(400).json({
        message: "Your balance is not enough.",
      });
    }

    if (user.energy === 5000) {
      return res.status(400).json({
        message: "Already Max level"
      })
    }

    const energy = user.energy;

    user.balance = balance - price[user.energy / 500 - 1];
    user.energy = energy + 500;
    await user.save();

    const userLevel = getUserLevel(user.totalEarned);

    return res.status(200).json({
      message: "Successfully upgraded",
      data: user,
      userLevel
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/items-list', async (req, res) => {
  try {

    /*if (!t_id) {
      return res.status(400).json({
        message: "Telegram ID required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }*/

    const items = await Item.find();

    return res.status(200).json({
      message: "Successfully fetched",
      data: items,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/add-balance', async (req, res) => {
  try {
    const { t_id, amount } = req.body;

    if (!t_id || amount === undefined) {
      return res.status(400).json({
        message: "Telegram ID and amount are required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Add the amount to the user's balance
    user.balance += amount;
    if (amount > 0)
      user.totalEarned += amount;
    await user.save();

    return res.status(200).json({
      message: "Balance successfully updated",
      balance: user.balance,
      totalEarned: user.totalEarned,
      userLevel: getUserLevel(user.totalEarned)
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/set-daily-reward', async (req, res) => {
  try {
    const { t_id, last_daily_reward } = req.body;

    if (!t_id || last_daily_reward === undefined) {
      return res.status(400).json({
        message: "Telegram ID and last daily reward are required.",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Set the last_daily_reward variable
    user.last_daily_reward = last_daily_reward;
    await user.save();

    return res.status(200).json({
      message: "Last daily reward successfully updated",
      last_daily_reward: user.last_daily_reward,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/set-social', async (req, res) => {
  try {
    const { t_id, number } = req.body;

    // Validate that number is a valid number
    if (isNaN(number)) {
      return res.status(400).json({
        message: "Invalid number provided",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const validNumber = Number(number);

    if (isNaN(user.social_claim)) {
      user.social_claim = 0;
    }

    user.social_claim += validNumber;

    await user.save();

    return res.status(200).json({
      message: "Social claim successfully updated",
      last_daily_reward: user.last_daily_reward,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/purchase-mine-card', async (req, res) => {
  try {
    const { t_id, index, purchase_amount } = req.body;
    if (!t_id || index != undefined) {
      return res.status(400).json({
        message: "Invalid id or index",
      });
    }

    const user = await User.findOne({ t_id: t_id });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.mine_levels[index]++;
    user.balance -= purchase_amount;
    await user.save();

    return res.status(200).json({
      message: "Purchase mine card successfully",
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/item-purchase', authorizeBearerToken, async (req, res) => {
  try {
    const { userId, item_id } = req.body;

    if (!item_id) {
      return res.status(400).json({
        message: "Item ID required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const item = await Item.findById(item_id);

    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    // Find the existing item in user's items
    const existingItem = user.items.find(i => i.item_id === item_id);

    let item_level = 0;
    let itemCost = item.cost;

    if (existingItem) {
      // Upgrade item part
      item_level = existingItem.level + 1;
      if (item_level > 10) {
        return res.status(400).json({
          message: "Item level is over max - 10.",
        });
      }
      itemCost = item.cost * (1 + 0.2 * item_level);
    }

    const balance = user.balance;

    if (balance < itemCost) {
      return res.status(400).json({
        message: "Your balance is not enough.",
      });
    }

    if (existingItem) {
      // Update existing item's level
      existingItem.level = item_level;
      existingItem.time_stamp = new Date();

    } else {
      // Add new item with level 0
      user.items.push({ item_id, level: 1, time_stamp: new Date() });
    }

    // Update user's balance
    console.log(balance, itemCost, balance - itemCost);
    user.balance = balance - itemCost;

    await user.save();

    return res.status(200).json({
      message: "Successfully purchased",
      data: user,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/item-details', authorizeBearerToken, async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(userId)
    const user = (await User.find({ t_id: userId }))[0];

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const items = user.items;

    console.log(user);
    let data = [];
    let totalProfitPerHour = 0;

    // Use Promise.all to handle asynchronous operations within map
    const itemDetailsPromises = items?.map(async (item) => {
      const itemDetail = await Item.findById(item.item_id);

      if (itemDetail) {
        data.push({
          name: itemDetail.item_name,
          baseCost: itemDetail.cost * Math.pow(1.2, item.level),
          basePassiveIncome: itemDetail.passive_income * Math.pow(1.2, item.level),
          item_level: item.level
        });

        totalProfitPerHour += itemDetail.passive_income * Math.pow(1.2, item.level - 1);
      }
    });

    // Wait for all promises to resolve
    await Promise.all(itemDetailsPromises);

    return res.status(200).json({
      message: "Successfully retrieved",
      data,
      totalProfitPerHour
    });

  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});


app.delete("/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (item == null) {
      return res.status(404).json({ message: "Item not found" });
    }

    await item.remove();
    res.json({ message: "Deleted Item" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/bonous", async (req, res) => {
  const { id, title } = req.body;
  const currentDateTime = new Date();

  const recentSocials = await Social.find({
    t_id: id,
    s_name: title,
    s_date: { $gte: addHours(currentDateTime, -24) }, // Check if the s_date is within the last 24 hours
  });

  if (recentSocials.length > 0) {
    return res.json({ stats: "error", message: "You need more time" });
  }
  const item = await Item.findById(id);
  item.mount = item.mount + 10000;
  const updatedItem = await item.save();
  social = new Social({ t_id: id, s_name: title, s_date: currentDateTime });
  social
    .save()
    .then(() => {
      return res.json({ stats: "success", mount: item.mount });
    })
    .catch(() => {
      return res.json({ stats: "social save error" });
    });
});

app.get("/leaderboard", authorizeBearerToken, async (req, res) => {
  const { userId } = req.body;

  const user = (await User.find({ t_id: userId }))[0];

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const users = await User.find({});

  const usersWithInviteeCount = users?.map(user => {
    const inviteesThisWeek = user.invitees?.filter(invitee => {
      const inviteeDate = new Date(invitee.timestamp);
      return inviteeDate >= currentWeekStart && inviteeDate <= currentWeekEnd;
    });
    return {
      name: user.t_name,
      inviteeCount: inviteesThisWeek.length
    };
  });

  // Sort users by invitee count in descending order and get the top 10
  const topUsers = usersWithInviteeCount.sort((a, b) => b.inviteeCount - a.inviteeCount).slice(0, 10);

  return res.status(200).json({
    topUsers
  });
});

app.post("/login", async (req, res) => {
  const { tgId } = req.body;

  if (!tgId) {
    return res.status(400).json({
      message: "Telegram ID and Password required.",
    });
  }

  const user = await User.findOne({ t_id: tgId });

  if (!user) {
    return res.status(404).json({
      message: "Unregistered User",
    });
  }

  const currentTime = new Date();
  const passiveIncomePerHour = await calculatePassiveIncome(user.items);

  let roundedHours = 0;
  let totalPassiveIncome = 0;

  await user.save();


  const token = signToken({ userId: user.id });

  const userLevel = getUserLevel(user.totalEarned);

  return res.status(200).json({
    message: "Successfully logged in",
    data: user,
    token: token,
    userLevel,
    totalPassiveIncome: totalPassiveIncome,
    profitPerHour: passiveIncomePerHour,
    invitees: user.invitees
  });

})

app.post('/updated-login-time', authorizeBearerToken, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    const currentTime = new Date();

    user.last_login_timestamp = currentTime;

    await user.save();

    return res.status(200).json({
      message: "login time updated successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-hourly-time', authorizeBearerToken, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    const currentTime = new Date();

    user.last_hourly_claim_timestamp = currentTime;

    await user.save();

    return res.status(200).json({
      message: "login time updated successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-daily-time', authorizeBearerToken, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    const currentTime = new Date();

    user.last_daily_claim_timestamp = currentTime;

    await user.save();

    return res.status(200).json({
      message: "login time updated successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-hourly', authorizeBearerToken, async (req, res) => {
  const { userId, hourly } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    user.last_hourly_reward = hourly;

    await user.save();

    return res.status(200).json({
      message: "login time updated successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-daily', authorizeBearerToken, async (req, res) => {
  const { userId, daily } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    user.last_daily_reward = daily;

    await user.save();

    return res.status(200).json({
      message: "login time updated successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-wallet', authorizeBearerToken, async (req, res) => {
  const { userId, wallet } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Unregistered User",
      });
    }

    user.wallet = wallet;

    await user.save();

    return res.status(200).json({
      message: "Wallet Address saved successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }

})

app.post('/updated-user-data', authorizeBearerToken, async (req, res) => {
  const { userId } = req.body;

  const user = (await User.find({ t_id: userId }))[0];

  if (!user) {
    return res.status(404).json({
      message: "Unregistered User",
    });
  }

  const userLevel = getUserLevel(user.totalEarned);
  const passiveIncomePerHour = await calculatePassiveIncome(user.items);

  const currentTime = new Date();

  const lastLoginTime = new Date(user.last_login_timestamp);
  const hours = (currentTime - lastLoginTime) / 3600000;
  let roundedHours = hours;

  let totalPassiveIncome = 0;
  if (user.last_login_timestamp) {
    const lastLoginTime = new Date(user.last_login_timestamp);
    const hours = (currentTime - lastLoginTime) / 3600000;
    roundedHours = hours;
    totalPassiveIncome = Math.floor(passiveIncomePerHour * roundedHours);
    user.last_login_timestamp = currentTime;
    user.last_daily_reward = getDailyReward(hours);
  } else {
    user.last_login_timestamp = currentTime;
    user.last_daily_reward = getDailyReward(0);
  }

  let timecount = currentTime - lastLoginTime;
  let balance = user.balance;
  let totalEarned = user.totalEarned;
  balance = balance + totalPassiveIncome;
  totalEarned = totalEarned + totalPassiveIncome;

  user.balance = balance;
  user.totalEarned = totalEarned;
  user.earnPerTap = 2 * userLevel - 1;
  totalPassiveIncome = 0;
  user.save();

  return res.status(200).json({
    message: "Successfully received.",
    user: user,
    userLevel,
    profitPerHour: passiveIncomePerHour,
    totalPassiveIncome,
    timecount
  });

})

app.post('/get-friends', async (req, res) => {
  const { ids } = req.body;
  var friends = [];
  try {
    for (let i = 0; i < ids.length; i++) {
      let user = await User.findOne({ _id: new ObjectId(ids[i].toString()) });
      friends.push({
        name: user.t_name,
        id: user.t_id,
        balance: user.balance
      })
    }

    return res.status(200).json({
      message: "Success.",
      friends: friends
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server error"
    })
  }
})
// app.post("/register", async (req, res) => {
//   const { tgId, tgName } = req.body;

//   if (!tgId || !tgName) {
//     return res.status(400).json({
//       message: "Telegram ID, Username and Password required.",
//     });
//   }

//   const user = await User.findOne({ t_id: tgId });

//   if (user) {
//     return res.status(400).json({
//       message: `An account already exists with ${tgId}`,
//       data: tgId,
//     });
//   }

//   const newUser = new User({ t_id: tgId, t_name: tgName });
//   await newUser.save();

//   const referalToken = inviteToken({ userId: newUser.id });
//   const referalLink = baseFrontendUrl + "/invite?token=" + referalToken;

//   newUser.referalLink = referalLink;
//   await newUser.save();

//   return res.status(200).json({
//     message: 'Successfully registered',
//     data: newUser,
//   });
// })

const signToken = (payload = {}, expiresIn = '12h') => {
  const token = jwt.sign(payload, JWT_SECRET)
  return token
}

const inviteToken = (payload = {}) => {
  const token = jwt.sign(payload, INVITE_SECRET)
  return token
}

const getDailyReward = (hours) => {
  const rewards = [
    1000,
    5000, 
    8000,
    15000,
    30000,
    50000,
    150000,
    200000,
    1200000,
    3500000
  ];
  let total = 0;
  for (let i =0; i < (hours / 24) + 1; i ++)
    total += rewards[i];
  return total;
}

const getUserLevel = (balance) => {
  const levels = [
    { "level": 1, "name": "Newbie", "balance": 0 },
    { "level": 2, "name": "Explorer", "balance": 2500 },
    { "level": 3, "name": "Adventurer", "balance": 7500 },
    { "level": 4, "name": "Challenger", "balance": 15000 },
    { "level": 5, "name": "Bronze", "balance": 30000 },
    { "level": 6, "name": "Silver", "balance": 50000 },
    { "level": 7, "name": "Gold", "balance": 100000 },
    { "level": 8, "name": "Platinum", "balance": 250000 },
    { "level": 9, "name": "Diamond", "balance": 500000 },
    { "level": 10, "name": "Champion", "balance": 1000000 },
    { "level": 11, "name": "Hero", "balance": 2000000 },
    { "level": 12, "name": "Epic", "balance": 5000000 },
    { "level": 13, "name": "Mythic", "balance": 10000000 },
    { "level": 14, "name": "Legendary", "balance": 20000000 },
    { "level": 15, "name": "Master", "balance": 30000000 },
    { "level": 16, "name": "Grandmaster", "balance": 50000000 },
    { "level": 17, "name": "Overlord", "balance": 75000000 },
    { "level": 18, "name": "Titan", "balance": 100000000 },
    { "level": 19, "name": "Immortal", "balance": 150000000 },
    { "level": 20, "name": "Supreme", "balance": 200000000 },
    { "level": 21, "name": "Celestial", "balance": 275000000 },
    { "level": 22, "name": "Ethereal", "balance": 375000000 },
    { "level": 23, "name": "Cosmic", "balance": 500000000 },
    { "level": 24, "name": "Galactic", "balance": 650000000 },
    { "level": 25, "name": "Universal", "balance": 825000000 },
    { "level": 26, "name": "Omnipotent", "balance": 1025000000 },
    { "level": 27, "name": "Transcendent", "balance": 1250000000 },
    { "level": 28, "name": "Infinite", "balance": 1500000000 },
    { "level": 29, "name": "Eternal", "balance": 1775000000 },
    { "level": 30, "name": "Godlike", "balance": 2075000000 },
    { "level": 31, "name": "Ascendant", "balance": 2400000000 },
    { "level": 32, "name": "Sovereign", "balance": 2750000000 },
    { "level": 33, "name": "Almighty", "balance": 3125000000 },
    { "level": 34, "name": "Omniscient", "balance": 3525000000 },
    { "level": 35, "name": "Divine", "balance": 3950000000 },
    { "level": 36, "name": "Sublime", "balance": 4400000000 },
    { "level": 37, "name": "Exalted", "balance": 4875000000 },
    { "level": 38, "name": "Paramount", "balance": 5375000000 },
    { "level": 39, "name": "Supernal", "balance": 5900000000 },
    { "level": 40, "name": "Empyrean", "balance": 6450000000 },
    { "level": 41, "name": "Astral", "balance": 7025000000 },
    { "level": 42, "name": "Quantum", "balance": 7625000000 },
    { "level": 43, "name": "Dimensional", "balance": 8250000000 },
    { "level": 44, "name": "Multiversal", "balance": 8900000000 },
    { "level": 45, "name": "Omniversal", "balance": 9575000000 },
    { "level": 46, "name": "Primordial", "balance": 10275000000 },
    { "level": 47, "name": "Eldritch", "balance": 11000000000 },
    { "level": 48, "name": "Arcane", "balance": 11750000000 },
    { "level": 49, "name": "Mystic", "balance": 12525000000 },
    { "level": 50, "name": "Enigmatic", "balance": 13325000000 },
    { "level": 51, "name": "Ineffable", "balance": 14150000000 },
    { "level": 52, "name": "Phantasmal", "balance": 15000000000 },
    { "level": 53, "name": "Numinous", "balance": 15875000000 },
    { "level": 54, "name": "Sublime", "balance": 16775000000 },
    { "level": 55, "name": "Transcendental", "balance": 17700000000 },
    { "level": 56, "name": "Metaphysical", "balance": 18650000000 },
    { "level": 57, "name": "Quintessential", "balance": 19625000000 },
    { "level": 58, "name": "Superlative", "balance": 20625000000 },
    { "level": 59, "name": "Paragon", "balance": 21650000000 },
    { "level": 60, "name": "Zenith", "balance": 22700000000 },
    { "level": 61, "name": "Apex", "balance": 23775000000 },
    { "level": 62, "name": "Pinnacle", "balance": 24875000000 },
    { "level": 63, "name": "Acme", "balance": 26000000000 },
    { "level": 64, "name": "Vertex", "balance": 27150000000 },
    { "level": 65, "name": "Apogee", "balance": 28325000000 },
    { "level": 66, "name": "Culmination", "balance": 29525000000 },
    { "level": 67, "name": "Paramount", "balance": 30750000000 },
    { "level": 68, "name": "Sublime", "balance": 32000000000 },
    { "level": 69, "name": "Quintessence", "balance": 33275000000 },
    { "level": 70, "name": "Epitome", "balance": 34575000000 },
    { "level": 71, "name": "Nonpareil", "balance": 35900000000 },
    { "level": 72, "name": "Peerless", "balance": 37250000000 },
    { "level": 73, "name": "Unrivaled", "balance": 38625000000 },
    { "level": 74, "name": "Unparalleled", "balance": 40025000000 },
    { "level": 75, "name": "Incomparable", "balance": 41450000000 },
    { "level": 76, "name": "Matchless", "balance": 42900000000 },
    { "level": 77, "name": "Inimitable", "balance": 44375000000 },
    { "level": 78, "name": "Sui Generis", "balance": 45875000000 },
    { "level": 79, "name": "Ne Plus Ultra", "balance": 47400000000 },
    { "level": 80, "name": "Apotheosis", "balance": 48950000000 },
    { "level": 81, "name": "Paragon", "balance": 50525000000 },
    { "level": 82, "name": "Nonpareil", "balance": 52125000000 },
    { "level": 83, "name": "Quintessential", "balance": 53750000000 },
    { "level": 84, "name": "Transcendent", "balance": 55400000000 },
    { "level": 85, "name": "Sublime", "balance": 57075000000 },
    { "level": 86, "name": "Ineffable", "balance": 58775000000 },
    { "level": 87, "name": "Supernal", "balance": 60500000000 },
    { "level": 88, "name": "Empyrean", "balance": 62250000000 },
    { "level": 89, "name": "Celestial", "balance": 64025000000 },
    { "level": 90, "name": "Divine", "balance": 65825000000 },
    { "level": 91, "name": "Omnipotent", "balance": 67650000000 },
    { "level": 92, "name": "Omniscient", "balance": 69500000000 },
    { "level": 93, "name": "Omnipresent", "balance": 71375000000 },
    { "level": 94, "name": "Absolute", "balance": 73275000000 },
    { "level": 95, "name": "Ultimate", "balance": 75200000000 },
    { "level": 96, "name": "Paramount", "balance": 77150000000 },
    { "level": 97, "name": "Supreme", "balance": 79125000000 },
    { "level": 98, "name": "Transcendental", "balance": 81125000000 },
    { "level": 99, "name": "Infinite", "balance": 83150000000 },
    { "level": 100, "name": "Omega", "balance": 85200000000 }
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (balance >= levels[i].balance) {
      return levels[i].level;
    }
  }
  return 0;
}

const calculatePassiveIncome = async (items) => {
  let totalPassiveIncomePerHour = 0;

  const passiveIncomePromises = items?.map(async (item) => {
    const itemId = item.item_id;
    const level = item.level;
    const item_db = await Item.findById(itemId);
    return item_db.passive_income * Math.pow(1.2, level - 1);
  });

  if (passiveIncomePromises) {
    const passiveIncomes = await Promise.all(passiveIncomePromises);

    passiveIncomes.forEach(passiveIncomePerHour => {
      totalPassiveIncomePerHour += passiveIncomePerHour;
    });
  }

  return totalPassiveIncomePerHour;
}

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

async function insertItems() {
  const items = [
    { item_level: 1, mission_name: "Training", item_name: "Gym", cost: 1500, passive_income: 150, img_src: "/images/gym.svg" },
    { item_level: 1, mission_name: "Training", item_name: "Sparring", cost: 5500, passive_income: 605, img_src: "/images/sparing.svg" },
    { item_level: 1, mission_name: "Training", item_name: "JiuJitsu", cost: 7300, passive_income: 876, img_src: "/images/braz.svg" },
    { item_level: 1, mission_name: "Training", item_name: "Taekwondo", cost: 18000, passive_income: 2340, img_src: "/images/kendo.svg" },
    { item_level: 1, mission_name: "Training", item_name: "Karate", cost: 27000, passive_income: 3780, img_src: "/images/karate.svg" },
    { item_level: 1, mission_name: "Training", item_name: "KungFu", cost: 35000, passive_income: 5250, img_src: "/images/judo.svg" },
    { item_level: 1, mission_name: "Training", item_name: "MuaiThai", cost: 57000, passive_income: 9120, img_src: "/images/muay.svg" },
    { item_level: 1, mission_name: "Training", item_name: "MMA", cost: 73000, passive_income: 12410, img_src: "/images/sambo.svg" },

    { item_level: 1, mission_name: "street", item_name: "VS.local gang", cost: 105000, passive_income: 13650, img_src: "/images/PDOGE/Rect1.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.country boss", cost: 139000, passive_income: 20155, img_src: "/images/PDOGE/Rect2.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.hidden expert", cost: 263000, passive_income: 42080, img_src: "/images/PDOGE/Rect3.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.former champion", cost: 375000, passive_income: 65625, img_src: "/images/PDOGE/Rect4.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.dark forces", cost: 518000, passive_income: 98420, img_src: "/images/PDOGE/Rect5.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.gang boss", cost: 620000, passive_income: 127100, img_src: "/images/PDOGE/Rect6.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.former fighting", cost: 777000, passive_income: 170940, img_src: "/images/PDOGE/Rect7.svg" },
    { item_level: 1, mission_name: "street", item_name: "VS.national championship", cost: 234765, passive_income: 234765, img_src: "/images/PDOGE/Rect8.svg" },
  ];

  try {
    const count = await Item.countDocuments();
    if (count === 0) {
      await Item.insertMany(items);
      console.log("Items inserted successfully");
    } else {
      console.log("Items collection already contains documents, skipping insertion.");
    }
  } catch (error) {
    console.log("Error in Items insert", error);
  }
}

module.exports = app;
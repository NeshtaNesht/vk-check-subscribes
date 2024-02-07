import express from "express";
import cookieParser from "cookie-parser";
import { getUserId, getVkData, getTokenAuth } from "./api.js";
import _ from "lodash";
import mysql from "mysql2";
import moment from "moment";
import { selectByDate, insertSubscribes } from "./sqlQuery.js";

/**
 * UI: Фильтр для выбора даты с которой сравнивать
 *
 */

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "check-subscribes-db",
  password: "***",
});

connection.connect(function (err) {
  if (err) {
    return console.error("Ошибка: " + err.message);
  } else {
    console.log("Подключение к серверу MySQL успешно установлено");
  }
});

const app = express();
const port = 3000;

app.use(cookieParser());
app.use(express.json());

app.all("*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://5b7ced31464e3b.lhr.life");
  res.header("Access-Control-Allow-Headers", [
    "X-Requested-With",
    "user_id",
    "Authorization",
    "content-type",
  ]);
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

/**
 * Прокся для кастомных запросов к ВК с ui
 */
app.post("/vk/*", async (req, res) => {
  const result = await getVkData(
    req.path.substring(4, req.path.length),
    req.body,
    req.headers.authorization,
    _.get(req, "headers.user_id")
  ).then((j) => j.json());
  res.send(result);
});

/**
 * Получить подписчиков по {groupId}
 */
app.get("/subscribes/:groupId", async (req, res) => {
  const emptyBody = {
    new: [],
    unsubscribes: [],
  };
  const groupId = _.get(req, "params.groupId");
  const queryDate = _.get(req, "query.date");
  if (!groupId) {
    res.status(400).send({
      message: "Не указан groupId",
    });
    return;
  }
  const resultVk = await getVkData(
    "groups.getMembers",
    {
      group_id: groupId,
    },
    getTokenAuth(req),
    getUserId(req)
  ).then((j) => j.json());

  const resultVkItems = _.get(resultVk, "response.items");
  const currentDate = moment().format("YYYY-MM-DD");
  // Проверим есть ли данные за сегодня
  connection.query(selectByDate, [currentDate], (err, result) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
      return;
    }
    // Если данных за сегодня нет, то вставим
    if (result.length === 0) {
      const newRowDb = [currentDate, resultVkItems.toString()];
      connection.query(insertSubscribes, [newRowDb], (insertErr, insertRes) => {
        if (insertErr) {
          throw insertErr;
        }
      });
    }
  });
  if (queryDate && queryDate !== "undefined") {
    connection.query(selectByDate, [queryDate], async (err, result) => {
      if (err) {
        console.log(err);
        res.send(500);
      }
      if (result.length === 0) {
        res.send(JSON.stringify(emptyBody));
        return;
      }
      const userIds = _.get(result, "[0].user_ids");
      // Находим разницу
      const resultVkItemsIdsString = resultVkItems.map((r) => r.toString());
      const difference = _.xor(userIds.split(","), resultVkItemsIdsString);
      // Если содержится в resultVkItems, то это новый подписчик
      const prepareBody = {
        new: [],
        unsubscribes: [],
      };
      difference.forEach((d) => {
        if (resultVkItemsIdsString.includes(d)) {
          prepareBody.new.push(d);
          return;
        }
        prepareBody.unsubscribes.push(d);
      });

      if (difference.length === 0) {
        res.send(JSON.stringify(emptyBody));
        return;
      }

      let usersNewGetResult;
      let usersUnsubscribesGetResult;
      if (prepareBody.new.length > 0) {
        usersNewGetResult = await getVkData(
          "users.get",
          {
            user_ids: prepareBody.new.join(","),
            fields: "photo_200,screen_name",
          },
          getTokenAuth(req),
          getUserId(req)
        ).then((j) => j.json());
      }
      if (prepareBody.unsubscribes.length > 0) {
        usersUnsubscribesGetResult = await getVkData(
          "users.get",
          {
            user_ids: prepareBody.unsubscribes.join(","),
            fields: "photo_200,screen_name",
          },
          getTokenAuth(req),
          getUserId(req)
        ).then((j) => j.json());
      }
      const body = {
        new: _.get(usersNewGetResult, "response", []),
        unsubscribes: _.get(usersUnsubscribesGetResult, "response", []),
      };
      res.send(JSON.stringify(body));
    });
  } else {
    res.send(emptyBody);
  }
});

app.listen(port);

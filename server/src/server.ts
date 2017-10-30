declare const require;
declare const __dirname;

interface ObjectConstructor {
  assign(target: any, ...sources: any[]): any;
}

const app = require('express')();
const bodyParser = require("body-parser");
const moment = require("moment");
const low = require("lowdb");
const path = require("path");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
const db = low(adapter);

const sortTodo = (a, b) => a.created - b.created;

const addItemToDB = (item, i, array) => {
  let todos = db.get("todos");
  let local_todos = todos.defaults({[item.dateKey]: []})
    .get(item.dateKey).value();
  
    local_todos.push(item);

  // sort
  todos.set(item.dateKey,
            local_todos.sort(sortTodo)).write();
};

const updateItemToDB = (item, i, array) => {
  // find and update
  db.get("todos").get(item.dateKey).find({_item: item._item}).assign(item).write();
}

db.defaults({ todos: {} })
  .write();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
 
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/todos", (req, res) => {
  res.json(db.get("todos").value());
});

app.patch("/todos", (req, res) => {
  let addItems = req.body.add;
  let updateItems = req.body.update;

  if (addItems) addItems.forEach(addItemToDB);
  if (updateItems) updateItems.forEach(updateItemToDB);
  res.json({add: addItems && addItems.length, updated: updateItems && updateItems.length});
});

// fetch todos for a specific day
app.get("/todos/:date", (req, res) => {
  let date = req.params.date;
  let todos = db.get("todos")
    .defaults({[date]: []})
    .get(date)
    .value();

  res.json(todos); 
});

app.post("/", (req, res) => {
  db.get("todos")
    .defaults({[req.body.dateKey]: []})
    .get(req.body.dateKey)
    .push(req.body)
    .write();

  res.json(Object.assign({id: db.get("todos." + req.body.dateKey).value().length}, req.body));
});
 
app.listen(2000);
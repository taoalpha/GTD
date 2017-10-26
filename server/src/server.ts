declare const require;
declare const __dirname;
const app = require('express')();
const bodyParser = require("body-parser");
const moment = require("moment");
const low = require("lowdb");
const path = require("path");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
const db = low(adapter);

db.defaults({ todos: {} })
  .write();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
 
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/", (req, res) => {
  db.get("todos")
    .defaults({[moment().format("YYYY-MM-DD")]: []})
    .get(moment().format("YYYY-MM-DD"))
    .push(req.body)
    .write();

  res.json({id: 1});
});
 
app.listen(2000);
var app = require('express')();
var bodyParser = require("body-parser");
var moment = require("moment");
var low = require("lowdb");
var path = require("path");
var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
var db = low(adapter);
db.defaults({ todos: {} })
    .write();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.get("/", function (req, res) {
    res.send("Hello World!");
});
app.get("/todos", function (req, res) {
    res.json(db.get("todos").value());
});
app.get("/todos/today", function (req, res) {
    var todayTodos = db.get("todos")
        .defaults((_a = {}, _a[moment().format("YYYY-MM-DD")] = [], _a))
        .get(moment().format("YYYY-MM-DD"))
        .value();
    res.json(todayTodos);
    var _a;
});
app.post("/", function (req, res) {
    db.get("todos")
        .defaults((_a = {}, _a[moment().format("YYYY-MM-DD")] = [], _a))
        .get(moment().format("YYYY-MM-DD"))
        .push(req.body)
        .write();
    res.json({ id: db.get("todos." + moment().format("YYYY-MM-DD")).value().length });
    var _a;
});
app.listen(2000);

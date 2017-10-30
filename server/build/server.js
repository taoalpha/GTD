var app = require('express')();
var bodyParser = require("body-parser");
var moment = require("moment");
var low = require("lowdb");
var path = require("path");
var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
var db = low(adapter);
var sortTodo = function (a, b) { return a.created - b.created; };
var addItemToDB = function (item, i, array) {
    var todos = db.get("todos");
    var local_todos = todos.defaults((_a = {}, _a[item.dateKey] = [], _a))
        .get(item.dateKey).value();
    local_todos.push(item);
    // sort
    todos.set(item.dateKey, local_todos.sort(sortTodo)).write();
    var _a;
};
var updateItemToDB = function (item, i, array) {
    // find and update
    db.get("todos").get(item.dateKey).find({ _item: item._item }).assign(item).write();
};
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
app.patch("/todos", function (req, res) {
    var addItems = req.body.add;
    var updateItems = req.body.update;
    if (addItems)
        addItems.forEach(addItemToDB);
    if (updateItems)
        updateItems.forEach(updateItemToDB);
    res.json({ add: addItems && addItems.length, updated: updateItems && updateItems.length });
});
// fetch todos for a specific day
app.get("/todos/:date", function (req, res) {
    var date = req.params.date;
    var todos = db.get("todos")
        .defaults((_a = {}, _a[date] = [], _a))
        .get(date)
        .value();
    res.json(todos);
    var _a;
});
app.post("/", function (req, res) {
    db.get("todos")
        .defaults((_a = {}, _a[req.body.dateKey] = [], _a))
        .get(req.body.dateKey)
        .push(req.body)
        .write();
    res.json(Object.assign({ id: db.get("todos." + req.body.dateKey).value().length }, req.body));
    var _a;
});
app.listen(2000);

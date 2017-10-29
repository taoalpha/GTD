var Status;
(function (Status) {
    Status["ongoing"] = "ongoing";
    Status["fail"] = "fail";
    Status["done"] = "done";
})(Status || (Status = {}));
var moment = require("moment");
var rp = require("request-promise");
var fs = require("fs");
var path = require("path");
var chalk = require("chalk");
// for local storage
var low = require("lowdb");
var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
var db = low(adapter);
db.defaults({ todos: {} })
    .write();
/*
 *
 * @example
 *
 * let gtd = new GTD({});
 * gtd[action](params);
 *
 */
module.exports = /** @class */ (function () {
    function GTD() {
        this.placeRegex = /#(?:\((.*?)\)(?=\s|$)|(.+?)(?=\s|$))/;
        this.timeRegex = /@\((.*?)\-(.*?)\)(?=\s|$)/;
        this.timeRegexPlus = /@([^{<].+?)\+(.+?)(?=\s|$)/;
        this.options = {};
        this.MAX_RETRY = 3;
        this.retry = 0;
        try {
            var configs = fs.readFileSync(path.join(__dirname, "configs"), "utf-8");
            this.options = JSON.parse(configs);
        }
        catch (e) { }
        ;
        this._updateConfig();
        this._sync();
    }
    GTD.prototype._updateConfig = function () {
        this.apiUrl = (this.options.host.slice(0, 4) === "http" ? this.options.host : "http://" + this.options.host) + ":" + (this.options.port || 80);
    };
    /**
     * sync local with server asynchronously
     */
    GTD.prototype._sync = function () {
        var _this = this;
        var last_sync_time = db.get("last_sync_time").value();
        // sync every certain time
        if (last_sync_time && Math.abs(moment(last_sync_time).diff(moment(), "seconds", true)) < 10)
            return;
        db.set("last_sync_time", moment()).write();
        this.syncing = true;
        console.info(chalk.yellow("Syncing..."));
        if (this.options.host) {
            rp({
                url: this.apiUrl + "/todos",
                method: "GET",
                json: true
            }).then(function (todos) {
                var local_todos = db.get("todos");
                var merged_todos = {};
                var server_update_items = {};
                Object.keys(todos).forEach(function (dateStr) {
                    server_update_items[dateStr] = [];
                    merged_todos[dateStr] = _this._mergeTodos(todos[dateStr], local_todos.defaults(dateStr, []).get(dateStr).value(), server_update_items[dateStr]);
                });
                _this._syncLocal(merged_todos);
                _this._syncServer(server_update_items);
            });
        }
        else {
            console.warn("No valid host set!");
        }
    };
    GTD.prototype._mergeTodos = function (server, local, server_to_update) {
        if (server === void 0) { server = []; }
        if (local === void 0) { local = []; }
        if (server_to_update === void 0) { server_to_update = []; }
        var merged = server.map(function (server_todo) {
            var local_todo;
            for (var i = 0; i < local.length; i++) {
                if (local[i]._item == server_todo._item) {
                    local_todo = local[i];
                    // mark as handled
                    local[i] = false;
                }
            }
            if (local_todo) {
                // determine whether to update or not
                if (moment(local_todo.updated).isAfter(moment(server_todo.updated))) {
                    server_to_update.push({
                        action: "update",
                        entry: local_todo
                    });
                    return local_todo;
                }
                return server_todo;
            }
            else {
                return server_todo;
            }
        });
        // for those items that hasn't been touched yet
        local.forEach(function (local_todo) {
            if (local_todo) {
                // server doesn't have it
                merged.push(local_todo);
                server_to_update.push({
                    action: "add",
                    entry: local_todo
                });
            }
        });
        // return as a sorted order
        return merged.sort(this._sortTodo);
    };
    /**
     * sync server items to local
     * @param todos
     */
    GTD.prototype._syncLocal = function (todos) {
        db.set("todos", todos).write();
        this.syncing = false;
    };
    /**
     * sync local items to server if needed
     * @param todos
     */
    GTD.prototype._syncServer = function (todos) {
        var batched = {};
        var count = 0;
        Object.keys(todos).forEach(function (dateStr) {
            todos[dateStr].forEach(function (todo) {
                batched[todo.action] = batched[todo.action] || [];
                batched[todo.action].push(todo.entry);
                count++;
            });
        });
        if (count && this.options.host) {
            rp({
                url: this.apiUrl + "/todos",
                method: "PATCH",
                json: true,
                body: batched
            }).then(function (data) {
                console.info(chalk.yellow("Sync finished!"));
                console.info(JSON.stringify(data, null, 2));
            });
        }
        else {
            console.info(chalk.yellow("Sync finished!"));
        }
    };
    GTD.prototype.add = function (item) {
        var _this = this;
        if (item === void 0) { item = ""; }
        var parsedItem = this._parse(item);
        // TODO: store locally and sync after host available
        var todos_db = db.get("todos")
            .defaults((_a = {}, _a[moment(parsedItem.created).format("YYYY-MM-DD")] = [], _a));
        var todos = todos_db.get(moment(parsedItem.created).format("YYYY-MM-DD")).value();
        todos.push(parsedItem);
        // store sorted items
        todos_db.set(moment(parsedItem.created).format("YYYY-MM-DD"), todos.sort(this._sortTodo)).write();
        // if set host, sync with server side
        if (this.options.host) {
            rp({
                url: this.apiUrl,
                method: "POST",
                json: true,
                body: parsedItem
            }).then(function (data) {
                _this._printTodos([data]);
            });
        }
        var _a;
    };
    GTD.prototype._sortTodo = function (a, b) {
        return a.created - b.created;
    };
    /**
     * set host / port that todos will be sent to
     * @param options
     */
    GTD.prototype.set = function (options) {
        var _this = this;
        if (options === void 0) { options = ""; }
        options.split(" ").forEach(function (op) {
            var _a = op.split("="), key = _a[0], value = _a[1];
            if (typeof key !== "undefined" && typeof value !== "undefined") {
                _this.options[key] = value;
            }
        });
        fs.writeFileSync(path.join(__dirname, "configs"), JSON.stringify(this.options));
        this._updateConfig();
    };
    // support actions
    GTD.prototype.hasAction = function (action) {
        return Object.keys(GTD.prototype).filter(function (v) { return v[0] !== "_"; }).indexOf(action) > -1;
    };
    /**
     * show todos for someday
     * @param date
     */
    GTD.prototype.show = function (date) {
        if (date === void 0) { date = moment(); }
        if (this.syncing)
            return setTimeout(this.show.bind(this), 200);
        date = moment(date);
        var dateStr = moment(date).format("YYYY-MM-DD");
        this._printTodos(db.get("todos")
            .defaults((_a = {}, _a[dateStr] = [], _a))
            .get(dateStr)
            .value());
        var _a;
    };
    /**
     * mark an item as done
     * @param item
     */
    GTD.prototype.done = function (item) {
    };
    /**
     * print todos
     * @param todos
     */
    GTD.prototype._printTodos = function (todos) {
        var _this = this;
        if (todos === void 0) { todos = []; }
        var todosPretty = todos.map(function (todo, i) {
            var item = todo._item;
            // unlikely happen, but just for safety
            if (!item)
                return;
            item = chalk.green("    " + (i + 1) + ". [ " + (todo.status === "done" ? "x" : "") + " ] " + item.replace(_this.placeRegex, function (match) { return chalk.yellow(match); })
                .replace(_this.timeRegex, function (match) { return chalk.cyan(match); })
                .replace(_this.timeRegexPlus, function (match) { return chalk.cyan(match); }));
            // add a strikehtrough for done item
            if (todo.status === "done")
                item = chalk.strikethrough(item);
            // red bg for failed item
            if (todo.status === "fail")
                item = chalk.bgRed.italic(item);
            return "" + item;
        });
        console.log(todosPretty.join("\n"));
    };
    GTD.prototype._parse = function (item) {
        if (item === void 0) { item = ""; }
        // TODO: walk through char by char
        if (!item)
            return;
        item = item.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
        var parsedItem = { _item: item, status: Status.ongoing };
        // parse the body
        // remove the time, place, heading or trailing spaces, multiple spaces into one space
        parsedItem.title = item.replace(this.timeRegex, "").replace(this.timeRegexPlus, "").replace(this.placeRegex, "");
        // parse time
        Object.assign(parsedItem, this._parseTime(item));
        // parse place
        Object.assign(parsedItem, this._parsePlace(item));
        return parsedItem;
    };
    GTD.prototype._parseTime = function (item) {
        var now = moment();
        var time = item.match(this.timeRegex);
        var parsedItem = {};
        parsedItem.created = now;
        parsedItem.updated = now;
        moment.relativeTimeRounding(function (value) { return +value.toFixed(2); }); // no rounding at all
        if (time) {
            parsedItem.begin = moment(time[1].trim(), "HH:mm A");
            parsedItem.end = moment(time[2].trim(), "HH:mm A");
            if (parsedItem.end.isBefore(parsedItem.begin))
                parsedItem.end = parsedItem.end.add(1, "d");
            parsedItem.duration = moment.duration(parsedItem.end.diff(parsedItem.begin));
        }
        else {
            time = item.match(this.timeRegexPlus);
            if (time) {
                parsedItem.begin = moment(time[1].trim(), "HH:mm A");
                var duration = time[2].trim();
                parsedItem.duration = moment.duration(parseFloat(duration), duration[duration.length - 1]);
                parsedItem.end = parsedItem.begin.clone().add(parsedItem.duration);
            }
        }
        if (parsedItem.duration) {
            parsedItem.durationPretty = parsedItem.duration.humanize();
        }
        // if begin is ahead of now, default to tomorrow
        // TODO: should support @<which day>
        if (parsedItem.begin && parsedItem.begin.isBefore(now)) {
            parsedItem.begin = parsedItem.begin.add(1, "d");
            parsedItem.end = parsedItem.end.add(1, "d");
        }
        return parsedItem;
    };
    GTD.prototype._parsePlace = function (item) {
        var place = item.match(this.placeRegex);
        if (place)
            return { place: (place[1] || place[2]).trim() };
        return {};
    };
    return GTD;
}());

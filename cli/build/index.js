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
    }
    GTD.prototype._updateConfig = function () {
        this.apiUrl = (this.options.host.slice(0, 4) === "http" ? this.options.host : "http://" + this.options.host) + ":" + (this.options.port || 80);
    };
    GTD.prototype.add = function (item) {
        if (item === void 0) { item = ""; }
        var parsedItem = this._parse(item);
        // TODO: store locally and sync after host available
        if (!this.options.host)
            throw new Error("No Available Host!");
        rp({
            url: this.apiUrl,
            method: "POST",
            json: true,
            body: parsedItem
        }).then(function (data) {
            console.log(data);
        });
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
        var _this = this;
        if (date === void 0) { date = moment(); }
        date = moment(date);
        var dateStr = moment(date).format("YYYY-MM-DD");
        rp({
            url: this.apiUrl + "/todos/" + dateStr,
            method: "GET",
            json: true
        }).then(function (data) {
            if (!data.length && _this.retry++ < _this.MAX_RETRY)
                _this.show(date.add(1, "d"));
            _this._printTodos(data);
        });
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
        var todosPretty = todos.map(function (todo, i) {
            var item = todo._item;
            if (!item)
                return;
            item = "\t " + (i + 1) + ". [ " + (todo.status === "done" ? "x" : "") + " ] " + item.replace(_this.placeRegex, function (match) { return chalk.yellow(match); })
                .replace(_this.timeRegex, function (match) { return chalk.cyan(match); })
                .replace(_this.timeRegexPlus, function (match) { return chalk.cyan(match); });
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
        item = item.replace(this.placeRegex, "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
        var parsedItem = { _item: item, status: Status.ongoing };
        // parse the body
        // remove the time, place, heading or trailing spaces, multiple spaces into one space
        parsedItem.title = item.replace(this.timeRegex, "").replace(this.timeRegexPlus, "");
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

var moment = require("moment");
var rp = require("request-promise");
var fs = require("fs");
var path = require("path");
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
        this.titleRegex = /^(.*?)[@|#]/;
        this.placeRegex = /#(?:\((.*?)\)(?=\s|$)|(.+?)(?=\s|$))/;
        this.timeRegex = /@\((.*?)\-(.*?)\)(?=\s|$)/;
        this.timeRegexPlus = /@([^{<].+?)\+(.+?)(?=\s|$)/;
        this.options = {};
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
        console.log(parsedItem);
        // rp({
        //   url: this.apiUrl,
        //   method: "POST",
        //   json: true,
        //   body: parsedItem
        // }).then(data => {
        //   console.log(data);
        // });
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
        date = moment(date).format("YYYY-MM-DD");
        rp({
            url: this.apiUrl + "/todos/" + date,
            method: "GET",
            json: true
        }).then(function (data) {
            console.log(data);
        });
    };
    GTD.prototype._parse = function (item) {
        if (item === void 0) { item = ""; }
        // TODO: walk through char by char
        if (!item)
            return;
        var parsedItem = { _item: item };
        // parse the body
        var title = item.match(this.titleRegex);
        if (title)
            parsedItem.title = title[1].trim();
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

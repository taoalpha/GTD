declare const module;
declare const __dirname;
declare const require;

// so to support Object.assign
declare interface ObjectConstructor {
  assign(target: any, ...sources: any[]): any;
}

interface LooseObject {
  [key: string]: any
}

const moment = require("moment");
const rp = require("request-promise");
const fs = require("fs");
const path = require("path");

/*
 *
 * @example
 * 
 * let gtd = new GTD({});
 * gtd[action](params);
 *
 */
module.exports = class GTD {
  private titleRegex = /^(.*?)[@|#]/;
  private placeRegex = /#(?:\((.*?)\)(?=\s|$)|(.+?)(?=\s|$))/;
  private timeRegex = /@\((.*?)\-(.*?)\)(?=\s|$)/;
  private timeRegexPlus = /@([^{<].+?)\+(.+?)(?=\s|$)/;
  private options : LooseObject = {};

  private apiUrl;

  constructor() {
    try {
      let configs = fs.readFileSync(path.join(__dirname, "configs"), "utf-8");
      this.options = JSON.parse(configs);
    } catch (e) {};

    this._updateConfig();
  }

  _updateConfig() {
    this.apiUrl = `${this.options.host.slice(0, 4) === "http" ? this.options.host : "http://" + this.options.host}:${this.options.port || 80}`;
  }

  add(item : String = "") {
    let parsedItem = this._parse(item);

    // TODO: store locally and sync after host available
    if (!this.options.host) throw new Error("No Available Host!");
    
    console.log(parsedItem);

    // rp({
    //   url: this.apiUrl,
    //   method: "POST",
    //   json: true,
    //   body: parsedItem
    // }).then(data => {
    //   console.log(data);
    // });
  }

  /**
   * set host / port that todos will be sent to
   * @param options 
   */
  set(options : String = "") {
    options.split(" ").forEach(op => {
      let [key, value] = op.split("=");
      if (typeof key !== "undefined" && typeof value !== "undefined") {
        this.options[key] = value;
      }
    });

    fs.writeFileSync(path.join(__dirname, "configs"), JSON.stringify(this.options));


    this._updateConfig();
  }

  // support actions
  hasAction(action) {
    return Object.keys(GTD.prototype).filter(v => v[0] !== "_").indexOf(action) > -1;
  }

  /**
   * show todos for someday
   * @param date 
   */
  show(date = moment()) {
    date = moment(date).format("YYYY-MM-DD");

    rp({
      url: `${this.apiUrl}/todos/${date}`,
      method: "GET",
      json: true,
    }).then(data => {
      console.log(data);
    });

  }

  _parse(item : String = "") {
    // TODO: walk through char by char
    if (!item) return;
    let parsedItem : LooseObject = { _item: item };
    
    // parse the body
    let title = item.match(this.titleRegex);
    if (title) parsedItem.title = title[1].trim();

    // parse time
    Object.assign(parsedItem, this._parseTime(item));

    // parse place
    Object.assign(parsedItem, this._parsePlace(item));
    return parsedItem;
  }

  _parseTime(item : String) {
    let now = moment();
    let time = item.match(this.timeRegex);
    let parsedItem : LooseObject = {};
    parsedItem.created = now;
    parsedItem.updated = now;
    moment.relativeTimeRounding(value => +value.toFixed(2));  // no rounding at all
    if (time) {
      parsedItem.begin = moment(time[1].trim(), "HH:mm A");
      parsedItem.end = moment(time[2].trim(), "HH:mm A");
      if (parsedItem.end.isBefore(parsedItem.begin)) parsedItem.end = parsedItem.end.add(1, "d");
      parsedItem.duration = moment.duration(parsedItem.end.diff(parsedItem.begin));
    } else {
      time = item.match(this.timeRegexPlus);
      if (time) {
        parsedItem.begin = moment(time[1].trim(), "HH:mm A");
        let duration = time[2].trim();
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
  }


  _parsePlace(item : String) {
    let place = item.match(this.placeRegex);
    if (place) return {place: (place[1] || place[2]).trim()};
    return {};
  }
}

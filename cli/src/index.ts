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
  private placeRegex = /#(.*?)(?=\s|$)/;
  private timeRegex = /@\((.*?)\-(.*?)\)(?=\s|$)/;
  private timeRegexPlus = /@([^{<].+?)\+(.+?)(?=\s|$)/;
  private options : LooseObject = {};
  constructor() {
    try {
      let configs = fs.readFileSync(path.join(__dirname, "configs"), "utf-8");
      this.options = JSON.parse(configs);
    } catch (e) {};
  }

  add(item : String = "") {
    let parsedItem = this.parse(item);
    rp({
      url: this.options.host ? `${this.options.host.indexOf("http") > -1 ? this.options.host : "http://" + this.options.host}:${this.options.port || 80}` : "http://localhost:1000",
      method: "POST",
      json: true,
      body: parsedItem
    }).then(data => {
      console.log(data);
    });
  }

  set(options : String = "") {
    options.split(" ").forEach(op => {
      let [key, value] = op.split("=");
      if (typeof key !== "undefined" && typeof value !== "undefined") {
        this.options[key] = value;
      }
    });

    fs.writeFileSync(path.join(__dirname, "configs"), JSON.stringify(this.options));
  }

  hasAction(action) {
    return ["add", "set"].indexOf(action) > -1;
  }

  parse(item : String = "") {
    // TODO: walk through char by char
    if (!item) return;
    let parsedItem : LooseObject = {};
    
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
    let time = item.match(this.timeRegex);
    let parsedItem : LooseObject = {};
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

    return parsedItem;
  }


  _parsePlace(item : String) {
    let place = item.match(this.placeRegex);
    if (place) return {place: place[1].replace(/^\(|\)$/g, "").trim()};  // remove `()`
    return {};
  }
}

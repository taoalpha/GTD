declare const module;
declare const require;

const moment = require("moment");
interface LooseObject {
  [key: string]: any
}


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
  constructor() {
  }

  add(item : String = "") {
    let parsedItem = this.parse(item);
    console.log(JSON.stringify(parsedItem));
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

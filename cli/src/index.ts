declare const module;
declare const __dirname;
declare const require;

// so to support Object.assign
declare interface ObjectConstructor {
  assign(target: any, ...sources: any[]): any;
}

enum STATUS {
  ongoing = "ongoing",
  fail = "fail",
  done = "done",
  deleted = "deleted"
}

interface LooseObject {
  [key: string]: any
}

const moment = require("moment");
const rp = require("request-promise");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// for local storage
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync(path.resolve(__dirname, "../db/db.json"));
const db = low(adapter);

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
module.exports = class GTD {
  private placeRegex = /#(?:\((.*?)\)(?=\s|$)|(.+?)(?=\s|$))/;
  private timeRegex = /@\((.*?)\-(.*?)\)(?=\s|$)/;
  private timeRegexPlus = /@([^{<].+?)\+(.+?)(?=\s|$)/;
  private options : LooseObject = {};

  private apiUrl;
  private MAX_RETRY = 3;
  private retry = 0;
  private syncing;
  private sync_idle_time = 10 * 60;

  constructor() {
    try {
      let configs = fs.readFileSync(path.join(__dirname, "configs"), "utf-8");
      this.options = JSON.parse(configs);
    } catch (e) {};

    this._updateConfig();

    // TODO: put sync to background process with `forever`
    this._sync();
  }

  _updateConfig() {
    this.apiUrl = `${this.options.host.slice(0, 4) === "http" ? this.options.host : "http://" + this.options.host}:${this.options.port || 80}`;
  }

  /**
   * sync local with server asynchronously
   */
  _sync() {
    let last_sync_time = db.get("last_sync_time").value();

    // sync every certain time
    if (last_sync_time && Math.abs(moment(last_sync_time).diff(moment(), "seconds", true)) < this.sync_idle_time) return;
    db.set("last_sync_time", moment()).write();
    this.syncing = true;
    console.info(chalk.yellow("Syncing..."));
    if (this.options.host) {
      rp({
        url: this.apiUrl + "/todos",
        method: "GET",
        json: true
      }).then(todos => {
          let local_todos = db.get("todos");
          let merged_todos : LooseObject = {};
          let server_update_items : LooseObject = {};
          Object.keys(todos).forEach(dateStr => {
            server_update_items[dateStr] = [];
            merged_todos[dateStr] = this._mergeTodos(todos[dateStr], local_todos.defaults(dateStr, []).get(dateStr).value(), server_update_items[dateStr]);
          });

          this._syncLocal(merged_todos);
          this._syncServer(server_update_items);
        });
    } else {
      console.warn("No valid host set!");
    }
  }

  _mergeTodos(server = [], local = [], server_to_update = []) {
    let merged = server.map(server_todo => {
      let local_todo;
      for (let i = 0; i < local.length; i++) {
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
      } else {
        return server_todo;
      }
    });

    // for those items that hasn't been touched yet
    local.forEach(local_todo => {
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
  }

  /**
   * sync server items to local
   * @param todos 
   */
  _syncLocal(todos) {
    db.set("todos", todos).write();
    this.syncing = false;
  }

  /**
   * sync local items to server if needed
   * @param todos 
   */
  _syncServer(todos) {
    let batched : LooseObject = {};
    let count = 0;
    Object.keys(todos).forEach(dateStr => {
      todos[dateStr].forEach(todo => {
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
      }).then(data => {
        console.info(chalk.yellow("Sync finished!"));
        console.info(JSON.stringify(data, null, 2));
      });
    } else {
      console.info(chalk.yellow("Sync finished!"));
    }
  }

  add(item: String = "") {
    let parsedItem = this._parse(item);

    let todos_db = db.get("todos")
      .defaults({ [moment(parsedItem.begin || parsedItem.created).format("YYYY-MM-DD")]: [] });

    let todos = todos_db.get(moment(parsedItem.begin || parsedItem.created).format("YYYY-MM-DD")).value();
    todos.push(parsedItem);

    // store sorted items
    todos_db.set(moment(parsedItem.begin || parsedItem.created).format("YYYY-MM-DD"), todos.sort(this._sortTodo)).write();

    // if set host, sync with server side
    if (this.options.host) {
      rp({
        url: this.apiUrl,
        method: "POST",
        json: true,
        body: parsedItem
      }).then(data => {
        // this._printTodos([data]);
      });
    }

    // show current list of todo ?
    // this.show();
  }

  _sortTodo(a, b) {
    return a.created - b.created;
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
    if (this.syncing) return setTimeout(this.show.bind(this, date), 200);
    let todos = this._fetch(date);
    if (todos.length) this._printTodos(todos);
    else console.info(chalk.yellow("No Todos Found!"));
  }

  _fetch(date = moment()) {
    date = moment(date);
    let dateStr = moment(date).format("YYYY-MM-DD");
    let todos = db.get("todos")
        .defaults({[dateStr]: []})
        .get(dateStr)
        .filter(item => item.status != STATUS.deleted)
        .value();
    if (!todos.length && this.retry++ < this.MAX_RETRY) return this._fetch(date.add(1, "d"));
    return todos;
  }

  /**
   * mark an item as done
   * @param item 
   */
  done(idx, date) {
    this._update(idx, STATUS.done, date);
  }

  fail(idx, date) {
    this._update(idx, STATUS.fail, date);
  }

  undo(idx, date) {
    this._update(idx, STATUS.ongoing, date);
  }

  remove(idx, date) {
    this._update(idx, STATUS.deleted, date);
  }

  _update(idx, status, date = moment()) {
    let todos = this._fetch(date);
    if (todos[idx - 1]) {
      db.get("todos").get(moment(date).format("YYYY-MM-DD")).find({_item: todos[idx - 1]._item}).assign({status, updated: moment()}).write();
    } else {
      console.warn(chalk.yellow("Idx out of range!"));
    }

    // show updated items
    this.show(date);
  }

  /**
   * print todos
   * @param todos 
   */
  _printTodos(todos: any[] = []) {
    let todosPretty = todos.map((todo, i) => {
      let item = todo._item;

      // unlikely happen, but just for safety
      if (!item) return;
      item = `[ ${todo.status === STATUS.done ? "x" : todo.status === STATUS.fail ? "-" : " "} ] ${item.replace(this.placeRegex, match => chalk.yellow(match))
                  .replace(this.timeRegex, match => chalk.cyan(match))
                  .replace(this.timeRegexPlus, match => chalk.cyan(match))}`;

      // add a strikehtrough for done item
      if (todo.status === STATUS.done) item = chalk.strikethrough.dim(item);

      // red bg for failed item
      if (todo.status === STATUS.fail) item = chalk.bold.italic(item);

      return "    " + chalk.green(`${i + 1}. ${item}`);
    });

    console.log(todosPretty.join("\n"));
  }

  _parse(item : String = "") {
    // TODO: walk through char by char
    if (!item) return;
    item = item.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    let parsedItem : LooseObject = { _item: item, status: STATUS.ongoing};
    
    // parse the body
    // remove the time, place, heading or trailing spaces, multiple spaces into one space
    parsedItem.title = item.replace(this.timeRegex, "").replace(this.timeRegexPlus, "").replace(this.placeRegex, "");

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

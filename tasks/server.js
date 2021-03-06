const path = require("path");
const spawn = require("child_process").spawn;
let node;

module.exports = function() {
  this.gulp.task("server-restart", done => {
    if (node) node.kill();
    setTimeout(() => {
      node = spawn("npm", ["run", "server"], { stdio: "inherit" })
      node.on("close", function (code) {
        if (code === 8) {
          this.gulp.log("Error detected, waiting for changes...");
        }
      });
      done();
    }, 1000);
  });
};

process.on("exit", () => {
  if (node) node.kill();
});

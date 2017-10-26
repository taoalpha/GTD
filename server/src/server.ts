declare const require;
const app = require('express')();
const bodyParser = require("body-parser");

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
 
app.get("/", (req, res) => {
  res.send("Hello World!!!");
});

app.post("/", (req, res) => {
  console.log(req.body);
  res.json({id: 1});
});
 
app.listen(2000);
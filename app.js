'use strict';

// load modules
const express = require('express');
const jsonParser = require('body-parser').json;
const morgan = require('morgan');
const mongoose = require('mongoose');
const {Schema} = mongoose;
const User = require("./model").User;
const Course = require("./model").Course;
const auth = require("basic-auth");
const bcrypt = require("bcryptjs");

// variable to enable global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';

// create the Express app
const app = express();

// setup morgan which gives us http request logging
app.use(morgan('dev'));

// Body parser
app.use(jsonParser());

// Mongoose configuration
mongoose.connect('mongodb://localhost:27017/fsjstd-restapi');
const db = mongoose.connection;

db.on("error", function(err) {
  console.error("Connection error:", err);
});

db.once("open", function() {
  console.log("DB connection successful");
});

app.param("id", (req, res, next, id) => {
  Course.findById(id, (err, course) => {
    req.course = course;
    return next();
  });
});

// TODO setup your api routes here
app.get("/api/users", (req, res, next) => {
  const user = auth(req);
  if(user) {
    User.findOne({emailAddress: user.name}).then(data => {
      res.status(200);
      res.json(data);
    });
  } else {
    next();
  }
});

app.get("/api/users", (req, res, next) => {
  const user = auth(req);
    User.find({}).then(data => {
      res.status(200);
      res.json(data);
    });
});

app.post("/api/users", (req, res, next) => {
  if(req.body.password) {
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(req.body.password, salt);
    const user = new User(req.body); 
    req.body.password = hash;
  } else {
    return next(new Error("Password is required."));
  }
  user.save((err, data) => {
    if(err) console.error(err);
    res.status(201);
    res.location("/");
    res.end();
  });
});

app.get("/api/courses", (req, res) => {
  Course.find().then(data => {
    res.status(200);
    res.json(data);
  });
});

app.get("/api/courses/:id", (req, res) => {
  Course.findOne({_id: req.params.id}).then(data => {
    res.status(200);
    res.json(data);
  });
});

app.post("/api/courses", (req, res) => {
  const user = auth(req);
  User.findOne({emailAddress: user.name}).then(userData => {
    req.body.user = userData._id;
    Course.create(req.body).then(courseData => {
      res.status(201);
      res.location(`/api/courses/${courseData._id}`);
      res.end();
    });
  });
});

app.put("/api/courses/:id", (req, res) => {
  req.course.update(req.body, (err, result) => {
    res.end();
  });
});

app.delete("/api/courses/:id", (req, res) => {
  req.course.remove(() => {
    res.end();
  });
});

// setup a friendly greeting for the root route
app.get("/", (req, res) => {
  res.json({
    message: 'Welcome to the REST API project!',
  });
});

// send 404 if no other route matched
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found',
  });
});

// setup a global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {},
  });
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});

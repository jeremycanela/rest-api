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
mongoose.connect('mongodb://localhost:27017/fsjstd-restapi', {useNewUrlParser: true});
const db = mongoose.connection;

db.on("error", function(err) {
  console.error("Connection error:", err);
});

db.once("open", function() {
  console.log("DB connection successful");
});

// Targets all routes with the 'id' parameter
app.param("id", (req, res, next, id) => {
  Course.findById(id, (err, course) => {
    req.course = course;
    return next();
  });
});

// User authorization
app.use((req, res, next) => {
  const user = auth(req);
  if(user) {
    User.findOne({emailAddress: user.name}).then(data => {
      if(data) {
        return data;
      } else {
        res.status(401);
        return next(new Error("Invalid Authorization"));
      }
    }).then(data => {
      bcrypt.compare(user.pass, data.password, (err, valid) => {
        if(valid) {
          req.auth = true;
          req.userId = data._id;
          req.user = user.name;
          next();
        } else {
          res.status(401);
          req.auth = false;
          return next(new Error("Incorrect password"));
        }
      });
    });
  } else {
    next();
  }
});

// Returns the currently authorized user
app.get("/api/users", (req, res, next) => {
  if(req.auth) {
    User.findOne({emailAddress: req.user}).then(data => {
      res.status(200);
      res.json(data);
    });
  } else {
      res.status(401);
      return next(new Error("Invalid Authorization"));
  }
});

// Creates a new user
app.post("/api/users", (req, res, next) => {
  if(req.body.password) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);
    req.body.password = hash;
  } else {
    res.status(400);
    return next(new Error("Password is required."));
  }

  const regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if(!regex.test(String(req.body.emailAddress).toLowerCase())) {
    return next(new Error("Invalid email address"));
  }

  User.countDocuments({emailAddress: req.body.emailAddress}, (err, count) => {
    if(count > 0) return next(new Error("Email address is already in use"));
    User.create(req.body).then((data) => {
      res.status(201).location("/").end();
    }).catch(err => {
      res.status(400).json({error: err});
    });
  });
});

// Returns all the courses
app.get("/api/courses", (req, res) => {
  Course.find().populate("user", ["firstName", "lastName"]).exec((err, course) => {
    res.status(200);
    res.json(course);
  });
});

// Returns the specified course
app.get("/api/courses/:id", (req, res) => {
  Course.findOne({_id: req.params.id}).populate("user", ["firstName", "lastName"]).exec((err, course) => {
    res.status(200);
    res.json(course);
  });
});

// Creates a new course
app.post("/api/courses", (req, res, next) => {
  if(req.auth) {
    User.findOne({emailAddress: req.user}).then(userData => {
      req.body.user = userData;
      Course.create(req.body).then(courseData => {
        res.status(201);
        res.location(`/api/courses/${courseData._id}`);
        res.end();
      }).catch(err => {
        res.status(400).json({error: err});
      });
    });
  } else {
      res.status(401);
      return next(new Error("Invalid Authorization"));
  }
});

// Updates a course
app.put("/api/courses/:id", (req, res, next) => {
  if(req.auth) {
    Course.find({user: req.course.user}).then(course => {
      if(JSON.stringify(req.course.user) !== JSON.stringify(req.userId)) {
        res.status(403);
        return new Error("User is not authorized");
      }
    }).then(err => {
      if(err) return next(err);
      req.course.update(req.body, (err, result) => {
        res.status(204).end();
      }).catch(err => {
        res.status(400).json({error: err});
      });
    });
  } else {
    res.status(401);
    return next(new Error("Invalid Authorization"));
  }
});

// Deletes a course
app.delete("/api/courses/:id", (req, res, next) => {
  if(req.auth) {
    Course.find({user: req.course.user}).then(course => {
      if(JSON.stringify(req.course.user) !== JSON.stringify(req.userId)) {
        res.status(403);
        return new Error("User is not authorized");
      }
    }).then(err => {
      if(err) return next(err);
      req.course.remove(() => {
        res.status(204).end();
      });
    });
  } else {
    res.status(401);
    return next(new Error("Invalid Authorization"));
  }
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

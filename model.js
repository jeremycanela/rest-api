'use strict';

// Modules
const mongoose = require("mongoose");
const {Schema} = mongoose;

// User Schema
const UserSchema = new Schema({
  firstName: {type: String, required: [true, "First name is required."]},
  lastName: {type: String, required: [true, "Last name is required."]},
  emailAddress: {type: String, required: [true, "Email address is required."]},
  password: {type: String, required: [true, "Password is required."]}
});

// Course Schema
const CourseSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  title: {type: String, required: [true, "Title is required."]},
  description: {type: String, required: [true, "Description is required."]},
  estimatedTime: String,
  materialsNeeded: String
});

const User = mongoose.model("User", UserSchema);
const Course = mongoose.model("Course", CourseSchema);

module.exports = {User, Course};
const express = require("express");
const { check, validationResult } = require("express-validator");
const path = require("path");

// fileupload - import express-fileupload
const fileUpload = require("express-fileupload");

// Session - import express-session
const session = require("express-session");

// Import mongoose and connect to DB
const mongoose = require("mongoose");

// mongodb connection
mongoose.connect("mongodb://localhost:27017/bookLibrary", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Contact Model
// Mongoose will create a collection called 'customerInfo' in the MongoDB database
const Customer = mongoose.model("customerInfo", {
  name: String,
  email: String,
  phone: String,
  dept: String,
  photoName: String,
  date: String,
  query: String,
  sms: String,
});

// Session - create a model for admin users
const Admin = mongoose.model("Admin", {
  username: String,
  password: String,
});

let myApp = express();

// set up directories
myApp.set("views", path.join(__dirname, "views"));
myApp.use(express.static(__dirname + "/public"));
myApp.set("view engine", "ejs");
myApp.use(express.urlencoded({ extended: false }));
myApp.use(fileUpload()); // set up the express file upload middleware to be used with Express

// Session setup
myApp.use(
  session({
    secret: "shre1234567890",
    resave: false,
    saveUninitialized: true,
  })
);

// Admin account setup
myApp.get("/setup", function (req, res) {
  let adminData = {
    username: "admin",
    password: "admin123",
  };
  let newAdmin = new Admin(adminData);
  newAdmin.save();
  res.send("Done");
});

// render new request form on landing page
myApp.get("/", (req, res) => {
  res.render("home");
});

// render the login form for admin login
myApp.get("/login", (req, res) => {
  res.render("login"); // will render views/login.ejs
});

// end point to process login form after submission
myApp.post("/login-process", async (req, res) => {
  // fetch login data
  let username = req.body.username;
  let password = req.body.password;

  // find admin in the database and logs in if admin credentials are present in db
  const admin = await Admin.findOne({
    username,
    password,
  }).exec();

  if (admin) {
    req.session.username = admin.username;
    req.session.loggedIn = true;
    res.redirect("/admin-home");
  } else {
    let pageData = {
      error: "Login details not correct",
    };
    res.render("login", pageData);
  }
});

// end point for admin logout
myApp.get("/logout", (req, res) => {
  req.session.username = ""; // reset the username
  req.session.loggedIn = false; // make logged in false from true
  res.redirect("/login");
});

// landing page when admin logs in and displays all the records from DB
myApp.get("/admin-home", async (req, res) => {
  if (req.session.loggedIn) {
    // Fetch multiple records
    const data = await Customer.find();
    res.render("admin-home", { data });
  } else {
    res.redirect("/login");
  }
});

// View endpoint - using name from url to find the record to and display all data of that record to customer.ejs
myApp.get("/details/:id", async (req, res) => {
  const singleCustomer = await Customer.findOne({
    _id: req.params.id,
  }).exec();
  res.render("customerView", { customer: singleCustomer });
});

// custom regex operations
const phoneRegex = /^[0-9]{3}\-[0-9]{3}\-[0-9]{4}$/;

const checkRegex = (value, regex) => {
  return regex.test(value) ? true : false;
};

const checkPhone = (value) => {
  if (!checkRegex(value, phoneRegex)) {
    throw new Error("Phone should be in format xxx-xxx-xxxx");
  }

  return true;
};

// end point to process new request form submission
myApp.post(
  "/book-form",
  [
    // all checks will have to return true to pass validation
    check("name", "Must have a name").not().isEmpty(),
    check("email", "Must have an email").isEmail(),
    check("phone").custom(checkPhone),
    check("dept", "Please select department").not().isEmpty(),
    check("date", "please select date of issuing").not().isEmpty(),
    //check("query", "Please enter a description.").not().isEmpty(),
    check("sms", "Do you prefer SMS notifications?").not().isEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    // if errors then display errors on same page
    if (!errors.isEmpty()) {
      res.render("home", {
        errors: errors.array(),
      });
    } else {
      //if no errors save data in DB and render formthanks.ejs page
      let name = req.body.name;
      let email = req.body.email;
      let phone = req.body.phone;
      let dept = req.body.dept;
      let date = req.body.date;
      let query = req.body.query;
      let sms = req.body.sms;

      // if no file selected save empty in photo name field
      if (!req.files) {
        photoName = "Empty";
      } else {
        // if file is selected, fetch the file and get the name of the file
        photoName = req.files.photo.name;
        // get the actual file
        let photoFile = req.files.photo;
        // save the file
        let photoPath = "public/uploads/" + photoName;
        // move the temp file to a permanent location mentioned above
        photoFile.mv(photoPath, function (err) {
          console.log(err);
        });
      }

      // object passed in DB to save
      let customer = new Customer({
        name,
        email,
        phone,
        dept,
        photoName,
        date,
        query,
        sms,
      });

      customer.save();

      res.render("formthanks", {
        name,
        email,
      });
    }
  }
);

// Delete endpoint - using id from url to find the record to delete
myApp.get("/delete/:id", async (req, res) => {
  let id = req.params.id;
  await Customer.findByIdAndRemove({ _id: id }).exec();
  res.render("deleteThanks");
});

// Edit form GET endpoint - populate edit form using id to query for record in db
myApp.get("/edit/:id", async (req, res) => {
  let custId = req.params.id;
  const customer = await Customer.findOne({ _id: custId }).exec();

  // Send contact information to edit page
  res.render("edit", { customer });
});

// Update post endpoint
myApp.post("/edit/:id", async (req, res) => {
  // Grab our updated values from our request body
  let customerId = req.params.id;
  let name = req.body.name;
  let email = req.body.email;
  let phone = req.body.phone;
  let dept = req.body.dept;
  let date = req.body.date;
  let query = req.body.query;
  let sms = req.body.sms;

  if (!req.files) {
    let photos = await Customer.findOne({
      _id: customerId,
    }).exec();
    photoName = photos.photoName;
  } else {
    // fetch the file and get the name of the file
    photoName = req.files.photo.name;
    let photoFile = req.files.photo;
    // save the file
    let photoPath = "public/uploads/" + photoName;
    // move the temp file to a permanent location mentioned above
    photoFile.mv(photoPath, function (err) {
      console.log(err);
    });
  }

  // updateOne updates the data in the Db and will return the newest updated record
  await Customer.updateOne(
    { _id: customerId },
    { name, email, phone, dept, photoName, date, query, sms },
    { new: true }
  ).exec();

  res.render("editThanks", {
    name,
    email,
  });
});

myApp.listen(8086);
console.log("application is running on http://localhost:8086/");
